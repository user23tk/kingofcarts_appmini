import { type NextRequest, NextResponse } from "next/server"
import { LeaderboardManager } from "@/lib/leaderboard/leaderboard-manager"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const telegramId = searchParams.get("telegramId")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const userId = await LeaderboardManager.getUserIdFromTelegramId(Number(telegramId))

    if (!userId) {
      return NextResponse.json({ error: "User not found with this Telegram ID" }, { status: 404 })
    }

    return NextResponse.json({ userId })
  } catch (error) {
    console.error("[Debug] Error getting user by telegram ID:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get user" },
      { status: 500 }
    )
  }
}