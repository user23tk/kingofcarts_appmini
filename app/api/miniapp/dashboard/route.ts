import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { EventManager } from "@/lib/story/event-manager"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"
import { QueryCache } from "@/lib/cache/query-cache"
import { LeaderboardManager } from "@/lib/leaderboard/leaderboard-manager"
import { requireTelegramAuthGet } from "@/lib/miniapp/auth-middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTelegramAuthGet(request)
    if (!auth.authorized) {
      return auth.response!
    }
    const userId = auth.userId!

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    const securityCheck = await MiniAppSecurity.validateReadOnlyRequest(
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
          console.error("[Dashboard] User query error:", error)
          throw new Error("User not found")
        }
        return data
      },
      30,
    )

    if (!user) {
      console.error("[Dashboard] User not found in database")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    let totalPP = 0
    let chaptersCompleted = 0
    let themesCompleted = 0
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

    let eventPP = 0
    let eventRank = 0
    let rank = 0
    let totalPlayers = 0

    try {
      // Use LeaderboardManager to get consistent stats (PP, Rank, Chapters)
      const userStats = await LeaderboardManager.getUserStats(userId)
      if (userStats) {
        totalPP = userStats.totalPp
        chaptersCompleted = userStats.chaptersCompleted
        themesCompleted = userStats.themesCompleted
        rank = userStats.rank
        totalPlayers = userStats.totalPlayers
      }
    } catch (statsErr) {
      console.error("[Dashboard] Failed to get user stats via LeaderboardManager:", statsErr)
      // Fallback to direct query if LeaderboardManager fails
      const { data: progress, error: progressError } = await supabase.from("user_progress").select("*").eq("user_id", userId).single()
      if (!progressError && progress) {
        totalPP = progress.total_pp || 0
        chaptersCompleted = progress.chapters_completed || 0
        themesCompleted = progress.themes_completed || 0
      }
    }

    // Fetch progress for active session data (uncached to be fresh)
    const { data: progress } = await supabase.from("user_progress").select("*").eq("user_id", userId).single()

    const activeSession =
      progress?.current_theme && progress?.current_scene !== null
        ? {
          theme: progress.current_theme,
          chapter: progress.current_chapter || 1,
          scene: progress.current_scene,
        }
        : null

    let activeEvents: Array<{
      id: string
      theme: string
      title: string
      description?: string
      emoji: string
      multiplier: number
      endsAt?: string
    }> = []

    try {
      const activeEvent = await EventManager.getActiveEvent()
      if (activeEvent) {
        console.log("[Dashboard] Active event found:", {
          id: activeEvent.id,
          name: activeEvent.name,
          endDate: activeEvent.event_end_date
        })

        // Get user's event stats
        try {
          const eventStats = await EventManager.getUserEventRank(userId, activeEvent.name)
          if (eventStats) {
            eventPP = eventStats.total_pp
            eventRank = eventStats.rank
            console.log("[Dashboard] User event stats:", eventStats)
          }
        } catch (statsErr) {
          console.error("[Dashboard] Failed to get user event stats:", statsErr)
        }

        activeEvents = [
          {
            id: activeEvent.id,
            theme: activeEvent.name,
            title: activeEvent.title || activeEvent.name,
            description: activeEvent.description,
            emoji: activeEvent.event_emoji || activeEvent.emoji || "🎉",
            multiplier: activeEvent.pp_multiplier || 1.0,
            endsAt: activeEvent.event_end_date,
          },
        ]
      }
    } catch (eventErr) {
      console.error("[Dashboard] Failed to get events:", eventErr)
    }

    return NextResponse.json({
      user: {
        id: userId,
        username: user.username || "anonymous",
        firstName: user.first_name || "Traveler",
        totalPP,
        rank,
        eventPP, // Add event PP
        eventRank, // Add event Rank
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
    console.error("[Dashboard] API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
