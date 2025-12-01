import { NextResponse } from "next/server"
import { EventManager } from "@/lib/story/event-manager"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    console.log("[/api/leaderboard/event] Starting request")

    const activeEvent = await EventManager.getActiveEvent()

    console.log("[/api/leaderboard/event] activeEvent result:", activeEvent ? "found" : "null")

    if (!activeEvent) {
      console.log("[/api/leaderboard/event] No active event found")
      return NextResponse.json(
        {
          activeEvent: null,
          players: [],
          _debug: {
            timestamp: new Date().toISOString(),
            message: "No active event from RPC",
          },
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

    console.log("[/api/leaderboard/event] Active event found:", {
      name: activeEvent.name,
      title: activeEvent.title,
    })

    const themeKey = activeEvent.name

    let players: any[] = []
    try {
      players = await EventManager.getEventLeaderboard(themeKey, 100)
      console.log("[/api/leaderboard/event] Event leaderboard players count:", players.length)
    } catch (leaderboardError) {
      console.error("[/api/leaderboard/event] Error fetching event leaderboard:", leaderboardError)
      players = []
    }

    return NextResponse.json(
      {
        activeEvent: {
          id: activeEvent.id,
          theme_key: themeKey,
          event_name: activeEvent.title || activeEvent.name || themeKey,
          event_emoji: (activeEvent as any).event_emoji || (activeEvent as any).emoji || "🎄",
          pp_multiplier: (activeEvent as any).pp_multiplier || 1.5,
          event_end_date: activeEvent.event_end_date,
          description: activeEvent.description,
        },
        players: players.map((player: any, index: number) => ({
          rank: player.rank || index + 1,
          user_id: player.user_id,
          first_name: player.first_name || player.username || "Anonymous",
          total_pp: player.total_pp || 0,
          chapters_completed: player.chapters_completed || 0,
          last_updated: player.last_updated,
        })),
        _debug: {
          players_count: players.length,
          theme_key: themeKey,
          timestamp: new Date().toISOString(),
        },
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
    console.error("[/api/leaderboard/event] Error:", error)
    return NextResponse.json(
      {
        activeEvent: null,
        players: [],
        error: "Failed to fetch event data",
        _debug: {
          error_message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
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
