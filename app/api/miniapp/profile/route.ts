import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    const securityCheck = await MiniAppSecurity.validateReadOnlyRequest(
      userId,
      "VIEW_PROFILE",
      "profile",
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

    const { data: user, error: userError } = await supabase.from("users").select("*").eq("id", userId).single()

    if (userError || !user) {
      console.error("[v0] User not found:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { data: progress } = await supabase.from("user_progress").select("*").eq("user_id", userId).single()

    const { data: themeProgressData, error: themeProgressError } = await supabase.rpc("get_theme_progress", {
      p_user_id: userId,
    })

    if (themeProgressError) {
      console.error("[v0] Failed to fetch theme progress:", themeProgressError)
    }

    console.log("[v0] Theme progress from RPC:", themeProgressData)

    // Transform the RPC data to match the expected format
    const themeProgress =
      themeProgressData?.map((tp: any) => ({
        theme: tp.theme_name,
        chaptersCompleted: tp.chapters_completed || 0,
        totalChapters: tp.total_chapters || 0,
        bestScore: tp.total_pp || 0,
        lastPlayed: null, // RPC doesn't provide this, could be added later
      })) || []

    const totalPP = progress?.total_pp || 0
    const chaptersCompleted = progress?.chapters_completed || 0
    const themesCompleted = progress?.themes_completed || progress?.completed_themes?.length || 0

    const totalThemes = themeProgressData?.length || 7

    let rank = 1
    try {
      const { data: rankData } = await supabase.rpc("get_user_rank", {
        p_user_id: userId,
      })
      if (Array.isArray(rankData) && rankData.length > 0) {
        rank = rankData[0].rank || 1
      } else if (rankData && typeof rankData === "object" && "rank" in rankData) {
        rank = rankData.rank || 1
      } else if (typeof rankData === "number") {
        rank = rankData
      }
    } catch (err) {
      console.error("[v0] Rank calculation failed:", err)
    }

    console.log("[v0] Profile data:", {
      userId,
      totalPP,
      chaptersCompleted,
      themesCompleted,
      rank,
      themeProgressCount: themeProgress.length,
      themeProgress,
    })

    return NextResponse.json({
      user: {
        id: userId,
        username: user.username || "anonymous",
        firstName: user.first_name || "Traveler",
        lastName: user.last_name || "",
        totalPP,
        rank,
        joinedAt: user.created_at,
      },
      themeProgress,
      overallStats: {
        chaptersCompleted,
        themesCompleted,
        totalThemes,
        totalPP,
        rank,
      },
    })
  } catch (error) {
    console.error("[v0] Profile API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
