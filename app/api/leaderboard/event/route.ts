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

    let players: any[] = []
    try {
      players = await EventLeaderboardManager.getEventLeaderboard(themeKey, 100)
      console.log("[v0] Event leaderboard players count:", players.length)
    } catch (leaderboardError) {
      console.error("[v0] Error fetching event leaderboard, returning empty array:", leaderboardError)
      // Continue with empty players array - don't fail the whole request
      players = []
    }

    return NextResponse.json(
      {
        activeEvent: {
          id: activeEvent.id,
          theme_key: themeKey,
          event_name: activeEvent.title || activeEvent.name || themeKey,
          event_emoji: activeEvent.event_emoji || activeEvent.emoji || "🎮",
          pp_multiplier: activeEvent.pp_multiplier || 1.0,
          event_end_date: activeEvent.event_end_date,
          description: activeEvent.description,
        },
        players: players.map((player) => ({
          rank: player.rank,
          user_id: player.userId || player.user_id,
          first_name: player.firstName || player.first_name,
          total_pp: player.totalPp || player.total_pp,
          chapters_completed: player.chaptersCompleted || player.chapters_completed,
          last_updated: player.lastUpdated || player.last_updated,
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
        activeEvent: null,
        players: [],
        error: "Failed to fetch event data",
      },
      {
        status: 200, // Return 200 so UI can handle gracefully
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  }
}
