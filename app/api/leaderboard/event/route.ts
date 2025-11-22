import { NextResponse } from "next/server"
import { EventManager } from "@/lib/story/event-manager"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    console.log("[v0] Fetching active event and leaderboard")

    // Get active event
    const activeEvent = await EventManager.getActiveEvent()

    if (!activeEvent) {
      console.log("[v0] No active event found")
      return NextResponse.json({
        activeEvent: null,
        players: [],
      })
    }

    console.log("[v0] Active event found:", activeEvent)

    const themeKey = activeEvent.name

    // Get event leaderboard
    const players = await EventManager.getEventLeaderboard(themeKey, 100)

    console.log("[v0] Event leaderboard players count:", players.length)

    return NextResponse.json({
      activeEvent: {
        id: activeEvent.id,
        theme_key: themeKey,
        event_name: activeEvent.name || activeEvent.title || themeKey,
        event_emoji: activeEvent.emoji || activeEvent.event_emoji || "🎮",
        pp_multiplier: activeEvent.pp_multiplier || 1.0,
        event_end_date: activeEvent.event_end_date || activeEvent.end_date,
        description: activeEvent.description,
      },
      players: players.map((player: any, index: number) => ({
        rank: index + 1,
        user_id: player.user_id,
        first_name: player.first_name || player.username || "Anonymous",
        total_pp: player.total_pp || 0,
        chapters_completed: player.chapters_completed || 0,
        last_updated: player.last_updated || new Date().toISOString(),
      })),
    })
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
