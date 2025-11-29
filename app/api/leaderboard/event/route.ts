import { NextResponse } from "next/server"
import { EventManager } from "@/lib/story/event-manager"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    console.log("[v0] [/api/leaderboard/event] Starting request")

    // This ensures we use the same code path as the dashboard
    const activeEvent = await EventManager.getActiveEvent()

    console.log("[v0] [/api/leaderboard/event] activeEvent result:", activeEvent ? "found" : "null")

    if (!activeEvent) {
      console.log("[v0] [/api/leaderboard/event] No active event found, returning empty response")
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

    console.log("[v0] [/api/leaderboard/event] Active event found:", {
      id: activeEvent.id,
      name: activeEvent.name,
      title: activeEvent.title,
    })

    const themeKey = activeEvent.name

    let players: any[] = []
    try {
      players = await EventManager.getEventLeaderboard(themeKey, 100)
      console.log("[v0] [/api/leaderboard/event] Event leaderboard players count:", players.length)
    } catch (leaderboardError) {
      console.error("[v0] [/api/leaderboard/event] Error fetching event leaderboard:", leaderboardError)
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
        players: players.map((player: any) => ({
          rank: player.rank,
          user_id: player.user_id,
          first_name: player.first_name || player.username || "Anonymous",
          total_pp: player.total_pp,
          chapters_completed: player.chapters_completed,
          last_updated: player.last_updated,
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
    console.error("[v0] [/api/leaderboard/event] Error:", error)
    return NextResponse.json(
      {
        activeEvent: null,
        players: [],
        error: "Failed to fetch event data",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  }
}
