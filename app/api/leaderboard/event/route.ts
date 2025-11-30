import { NextResponse } from "next/server"
import { EventManager } from "@/lib/story/event-manager"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    console.log("[v0] [/api/leaderboard/event] Starting request")
    console.log(
      "[v0] [/api/leaderboard/event] SUPABASE_URL:",
      process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
    )
    console.log("[v0] [/api/leaderboard/event] SERVICE_ROLE_KEY present:", !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // This ensures we use the same code path as the dashboard
    const activeEvent = await EventManager.getActiveEvent()

    console.log("[v0] [/api/leaderboard/event] activeEvent result:", activeEvent ? "found" : "null")

    if (!activeEvent) {
      console.log("[v0] [/api/leaderboard/event] No active event found")
      console.log("[v0] [/api/leaderboard/event] Check: is get_active_event RPC returning data in DB?")
      console.log("[v0] [/api/leaderboard/event] Run: SELECT * FROM get_active_event();")
      return NextResponse.json(
        {
          activeEvent: null,
          players: [],
          _debug: {
            rpc_called: true,
            fallback_tried: true,
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
    }

    console.log("[v0] [/api/leaderboard/event] Active event found:", {
      id: activeEvent.id,
      name: activeEvent.name,
      title: activeEvent.title,
      is_active: activeEvent.is_active,
      event_start_date: activeEvent.event_start_date,
      event_end_date: activeEvent.event_end_date,
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
