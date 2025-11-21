import { NextResponse } from "next/server"
import { EventManager } from "@/lib/story/event-manager"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    console.log("[v0] [EVENT_LEADERBOARD] Fetching active event...")

    const activeEvent = await EventManager.getActiveEvent()

    if (!activeEvent) {
      console.log("[v0] [EVENT_LEADERBOARD] No active event found")
      return NextResponse.json({ activeEvent: null, players: [] })
    }

    console.log("[v0] [EVENT_LEADERBOARD] Active event:", activeEvent)

    const themeKey = activeEvent.name
    const players = await EventManager.getEventLeaderboard(themeKey, 100)

    console.log("[v0] [EVENT_LEADERBOARD] Retrieved", players.length, "players")

    return NextResponse.json({
      activeEvent: {
        ...activeEvent,
        theme_key: themeKey, // Add theme_key for frontend compatibility
      },
      players,
    })
  } catch (error) {
    console.error("[v0] [EVENT_LEADERBOARD] Error:", error)
    return NextResponse.json({ error: "Failed to fetch event leaderboard" }, { status: 500 })
  }
}
