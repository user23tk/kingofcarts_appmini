import { NextResponse } from "next/server"
import { LeaderboardManager } from "@/lib/leaderboard/leaderboard-manager"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    console.log("[v0] [API] Fetching leaderboard stats...")

    const stats = await LeaderboardManager.getLeaderboardStats()

    return NextResponse.json({
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] [API] Error fetching leaderboard stats:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard stats" }, { status: 500 })
  }
}
