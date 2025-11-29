import { NextResponse } from "next/server"
import { EventLeaderboardManager } from "@/lib/leaderboard/event-leaderboard-manager"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    console.log("[v0] Fetching active event and leaderboard")

    const activeEvent = await EventLeaderboardManager.getActiveEvent()

    if (!activeEvent) {
      console.log("[v0] No active event found")
      return NextResponse.json(
        {
          activeEvent: null,
          players: [],
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      )
    }

    console.log("[v0] Active event found:", activeEvent)

    const themeKey = activeEvent.name

    const players = await EventLeaderboardManager.getEventLeaderboard(themeKey, 100)

    console.log("[v0] Event leaderboard players count:", players.length)

    return NextResponse.json(
      {
        activeEvent: {
          id: activeEvent.id,
          theme_key: themeKey,
          event_name: activeEvent.name || activeEvent.title || themeKey,
          event_emoji: activeEvent.emoji || activeEvent.event_emoji || "🎮",
          pp_multiplier: activeEvent.pp_multiplier || 1.0,
          event_end_date: activeEvent.event_end_date || activeEvent.end_date,
          description: activeEvent.description,
        },
        players: players.map((player) => ({
          rank: player.rank,
          user_id: player.userId,
          first_name: player.firstName,
          total_pp: player.totalPp,
          chapters_completed: player.chaptersCompleted,
          last_updated: player.lastUpdated,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  } catch (error) {
    console.error("[v0] Error fetching event leaderboard:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch event leaderboard",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
