import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { EventManager } from "@/lib/story/event-manager"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"
import { QueryCache } from "@/lib/cache/query-cache"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    console.log("[v0] Dashboard API called for user:", userId)

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    const securityCheck = await MiniAppSecurity.validateRequest(
      userId,
      "VIEW_DASHBOARD",
      "dashboard",
      ipAddress,
      userAgent,
    )

    if (!securityCheck.success) {
      return NextResponse.json({ error: securityCheck.error }, { status: securityCheck.status })
    }

    const inputValidation = MiniAppSecurity.validateInput({ userId })
    if (!inputValidation.valid) {
      return NextResponse.json({ error: inputValidation.error }, { status: 400 })
    }

    const supabase = createAdminClient()

    const user = await QueryCache.get(
      `user:${userId}`,
      async () => {
        const { data, error } = await supabase.from("users").select("*").eq("id", userId).single()
        if (error) {
          console.error("[v0] User query error:", error)
          throw new Error("User not found")
        }
        return data
      },
      30,
    )

    if (!user) {
      console.error("[v0] User not found in database")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const progress = await QueryCache.get(
      `user_progress:${userId}`,
      async () => {
        const { data, error } = await supabase.from("user_progress").select("*").eq("user_id", userId).single()

        if (error) {
          console.error("[v0] Progress query error:", error)
          return null
        }
        return data
      },
      30,
    )

    const chaptersCompleted = progress?.chapters_completed || progress?.total_chapters_completed || 0
    const themesCompleted = progress?.themes_completed || progress?.completed_themes?.length || 0
    const totalPP = progress?.total_pp || 0

    console.log("[v0] User stats:", { chaptersCompleted, themesCompleted, totalPP })

    const totalThemes = await QueryCache.get(
      `total_themes`,
      async () => {
        const { count } = await supabase
          .from("themes")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
        return count || 7
      },
      300,
    )

    let rank = 0
    let totalPlayers = 0

    try {
      const { data: rankData, error: rankError } = await supabase.rpc("get_user_rank", {
        p_user_id: userId,
      })

      if (rankError) {
        console.error("[v0] Rank calculation error:", rankError)
        // rank remains 0 - correct for errors
      } else if (rankData && Array.isArray(rankData) && rankData.length > 0) {
        const rankInfo = rankData[0]
        rank = rankInfo.rank || 0
        totalPlayers = rankInfo.total_players || 0
        console.log("[v0] User rank:", rank, "out of", totalPlayers)
      } else {
        console.log("[v0] No rank data returned - user has no progress")
        // rank remains 0 - correct for users without progress
      }
    } catch (rankErr) {
      console.error("[v0] Rank calculation failed:", rankErr)
      // rank remains 0 - correct for network/database errors
    }

    const activeSession =
      progress?.current_theme && progress?.current_scene !== null
        ? {
            theme: progress.current_theme,
            chapter: progress.current_chapter || 1,
            scene: progress.current_scene,
          }
        : null

    console.log("[v0] Active session:", activeSession)

    let activeEvents = []
    try {
      const activeEvent = await EventManager.getActiveEvent()
      console.log("[v0] Active event from EventManager:", activeEvent)
      if (activeEvent) {
        activeEvents = [
          {
            id: activeEvent.id,
            theme: activeEvent.theme || activeEvent.name || activeEvent.theme_key,
            multiplier: activeEvent.pp_multiplier || 1.0,
            endsAt: activeEvent.event_end_date,
          },
        ]
        console.log("[v0] Active events array:", activeEvents)
      }
    } catch (eventErr) {
      console.error("[v0] Failed to get events:", eventErr)
    }

    return NextResponse.json({
      user: {
        id: userId,
        username: user.username || "anonymous",
        firstName: user.first_name || "Traveler",
        totalPP,
        rank,
      },
      stats: {
        chaptersCompleted,
        themesUnlocked: themesCompleted,
        totalThemes,
        currentStreak: 0,
      },
      activeSession,
      activeEvents,
    })
  } catch (error) {
    console.error("[v0] Dashboard API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
