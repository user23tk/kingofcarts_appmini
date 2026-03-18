import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"
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
      console.error("[Profile] User not found:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { data: progress } = await supabase.from("user_progress").select("*").eq("user_id", userId).single()

    const { data: themeProgressData, error: themeProgressError } = await supabase.rpc("get_theme_progress", {
      p_user_id: userId,
    })

    if (themeProgressError) {
      console.error("[Profile] Failed to fetch theme progress:", themeProgressError)
    }

    // Transform the RPC data to match the expected format
    const themeProgress =
      themeProgressData?.map((tp: any) => ({
        theme: tp.theme_name,
        chaptersCompleted: tp.chapters_completed || 0,
        totalChapters: tp.total_chapters || 0,
        bestScore: tp.total_pp || 0,
        lastPlayed: null,
      })) || []

    const totalPP = progress?.total_pp || 0
    const chaptersCompleted = progress?.chapters_completed || 0
    const themesCompleted = progress?.themes_completed || 0

    const totalThemes = themeProgressData?.length || 7

    let rank = 0
    try {
      const rankData = await LeaderboardManager.getUserRank(userId)
      if (rankData) {
        rank = rankData.rank
      }
    } catch (err) {
      console.error("[Profile] Rank calculation failed:", err)
    }

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
    console.error("[Profile] API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
