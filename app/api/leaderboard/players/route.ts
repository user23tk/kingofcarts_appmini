import { NextResponse } from "next/server"
import { LeaderboardManager } from "@/lib/leaderboard/leaderboard-manager"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    console.log("[v0] [API] Fetching leaderboard players...")

    const players = await LeaderboardManager.getTopPlayers(50)

    return NextResponse.json({
      players,
      count: players.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] [API] Error fetching leaderboard players:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard players" }, { status: 500 })
  }
}
