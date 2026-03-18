import { type NextRequest, NextResponse } from "next/server"
import { LeaderboardManager } from "@/lib/leaderboard/leaderboard-manager"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { requireTelegramAuthGet } from "@/lib/miniapp/auth-middleware"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const requestedUserId = searchParams.get("userId")
    const limit = Number.parseInt(searchParams.get("limit") || "100")
    const theme = searchParams.get("theme")

    const supabase = createAdminClient()

    let userId = null
    
    // If a specific user's rank is requested, we must authenticate them
    if (requestedUserId) {
      const auth = await requireTelegramAuthGet(request)
      if (!auth.authorized) {
        return auth.response!
      }
      userId = auth.userId!
      
      // Prevent IDOR: ensure the authenticated user matches the requested user
      if (userId !== requestedUserId) {
        return NextResponse.json({ error: "Unauthorized access to user profile" }, { status: 403 })
      }
      const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
      const userAgent = request.headers.get("user-agent") || undefined

      const securityCheck = await MiniAppSecurity.validateReadOnlyRequest(
        userId,
        "VIEW_LEADERBOARD",
        "leaderboard",
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
    }

    let players: any[] = []
    try {
      players = await LeaderboardManager.getTopPlayers(limit)
    } catch (err) {
      console.error("[v0] Failed to get top players:", err)
    }

    let userRank = null
    if (userId) {
      try {
        userRank = await LeaderboardManager.getUserRank(userId)
        console.log("[v0] User rank:", userRank)
      } catch (err) {
        console.error("[v0] Failed to get user rank:", err)
      }
    }

    let stats = null
    try {
      stats = await LeaderboardManager.getLeaderboardStats()
    } catch (err) {
      console.error("[v0] Failed to get stats:", err)
    }

    return NextResponse.json({
      rankings: players.map((player) => ({
        rank: player.rank,
        userId: player.userId,
        firstName: player.firstName || "Anonymous",
        totalPP: player.totalScore,
        chaptersCompleted: player.chaptersCompleted,
        isCurrentUser: userId ? player.userId === userId : false,
      })),
      userRank: userRank
        ? {
            rank: userRank.rank,
            totalPlayers: userRank.totalPlayers,
          }
        : null,
      stats,
    })
  } catch (error) {
    console.error("[v0] Leaderboard API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
