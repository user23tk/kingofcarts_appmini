import { NextResponse } from "next/server"
import { EventManager, type ActiveEvent, type EventPlayer } from "@/lib/story/event-manager"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
}

interface EventResponse {
  activeEvent: {
    id: string
    theme_key: string
    event_name: string
    event_emoji: string
    pp_multiplier: number
    event_end_date?: string
    description?: string
    has_ended: boolean
  } | null
  players: Array<{
    rank: number
    user_id: string
    first_name: string
    total_pp: number
    chapters_completed: number
    last_updated?: string
  }>
}

function formatEventResponse(event: ActiveEvent, players: EventPlayer[]): EventResponse {
  return {
    activeEvent: {
      id: event.id,
      theme_key: event.name,
      event_name: event.title || event.name,
      event_emoji: event.event_emoji || event.emoji || "🎄",
      pp_multiplier: event.pp_multiplier,
      event_end_date: event.event_end_date,
      description: event.description,
      has_ended: event.has_ended,
    },
    players: players.map((player, index) => ({
      rank: player.rank || index + 1,
      user_id: player.user_id,
      first_name: player.first_name || "Anonymous",
      total_pp: player.total_pp || 0,
      chapters_completed: player.chapters_completed || 0,
      last_updated: player.last_updated,
    })),
  }
}

export async function GET() {
  try {
    const activeEvent = await EventManager.getActiveEvent()

    if (!activeEvent) {
      return NextResponse.json(
        { activeEvent: null, players: [] },
        { headers: NO_CACHE_HEADERS },
      )
    }

    const players = await EventManager.getEventLeaderboard(activeEvent.name, 100)

    return NextResponse.json(
      formatEventResponse(activeEvent, players),
      { headers: NO_CACHE_HEADERS },
    )
  } catch (error) {
    console.error("[/api/leaderboard/event] Error:", error)
    return NextResponse.json(
      {
        activeEvent: null,
        players: [],
        error: "Failed to fetch event data"
      },
      { status: 500, headers: NO_CACHE_HEADERS },
    )
  }
}
