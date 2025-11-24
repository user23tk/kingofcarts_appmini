import { type NextRequest, NextResponse } from "next/server"
import { LeaderboardManager } from "@/lib/leaderboard/leaderboard-manager"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const userStats = await LeaderboardManager.getUserStats(userId)

    if (!userStats) {
      return NextResponse.json({ error: "User not found or error fetching stats" }, { status: 404 })
    }

    return NextResponse.json(userStats)
  } catch (error) {
    console.error("[Debug] Error fetching user stats:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user stats" },
      { status: 500 }
    )
  }
}