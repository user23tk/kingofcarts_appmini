import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { getAdminClient } from "@/lib/supabase/admin-singleton"
import { LeaderboardManager } from "@/lib/leaderboard/leaderboard-manager"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

/**
 * User Validator Endpoint
 * Validates user stats consistency with PP-first algorithm
 */
export async function GET(request: NextRequest) {
  // Check admin auth
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const userIdParam = searchParams.get("userId")
    const telegramIdParam = searchParams.get("telegramId")

    if (!userIdParam && !telegramIdParam) {
      return NextResponse.json({ error: "userId or telegramId required" }, { status: 400 })
    }

    const supabase = getAdminClient()
    let userId: string

    // Find user by telegramId if provided
    if (telegramIdParam) {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", Number.parseInt(telegramIdParam))
        .single()

      if (userError || !userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      userId = userData.id
    } else {
      userId = userIdParam!
    }

    // Get user stats using LeaderboardManager
    const userStats = await LeaderboardManager.getUserStats(userId)

    if (!userStats) {
      return NextResponse.json({ error: "User stats not found" }, { status: 404 })
    }

    // Get user rank using LeaderboardManager
    const rankData = await LeaderboardManager.getUserRank(userId)

    // Calculate theoretical PP based on formula: (chapters * 10) + (themes * 50)
    const theoreticalPP = userStats.chapters_completed * 10 + userStats.themes_completed * 50

    // Validate PP consistency
    const warnings: string[] = []

    if (userStats.total_pp !== theoreticalPP) {
      warnings.push(
        `PP mismatch: Current ${userStats.total_pp} PP, expected ${theoreticalPP} PP (${userStats.chapters_completed} chapters * 10 + ${userStats.themes_completed} themes * 50)`,
      )
    }

    if (userStats.total_pp < 0) {
      warnings.push("Negative PP detected - data corruption possible")
    }

    if (userStats.chapters_completed < userStats.themes_completed) {
      warnings.push("More themes completed than chapters - impossible state")
    }

    // Get theme progress details
    const { data: themeProgress } = await supabase
      .from("user_progress")
      .select("theme_id, theme_name, chapters_completed, is_completed")
      .eq("user_id", userId)

    return NextResponse.json({
      identity: {
        userId: userStats.user_id,
        telegramId: userStats.telegram_id,
        username: userStats.username || "Unknown",
      },
      ppAndRank: {
        totalPP: userStats.total_pp,
        rank: rankData?.rank || null,
        percentile: rankData?.percentile || null,
        theoreticalPP,
        ppConsistent: userStats.total_pp === theoreticalPP,
      },
      progress: {
        chaptersCompleted: userStats.chapters_completed,
        themesCompleted: userStats.themes_completed,
        themeProgress: themeProgress || [],
      },
      validation: {
        isValid: warnings.length === 0,
        warnings,
        lastUpdated: userStats.last_active,
      },
    })
  } catch (error) {
    logger.error("[user-validator] User validator error:", error)
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}
