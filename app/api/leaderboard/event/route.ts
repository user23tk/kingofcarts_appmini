import { NextResponse } from "next/server"
import { EventManager } from "@/lib/story/event-manager"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    console.log("[v0] Fetching event for leaderboard (with 7-day visibility window)")

    const eventWithStatus = await EventManager.getEventForLeaderboard()

    if (!eventWithStatus) {
      console.log("[v0] No active or recently closed event found")
      return NextResponse.json(
        {
          activeEvent: null,
          players: [],
          status: null,
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

    console.log("[v0] Event found:", eventWithStatus.name, "Status:", eventWithStatus.status)

    const themeKey = eventWithStatus.name
    const supabase = await createClient()

    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from("event_leaderboard")
      .select("user_id, total_pp, chapters_completed, rank, last_updated")
      .eq("theme", themeKey)
      .order("rank", { ascending: true })
      .limit(100)

    if (leaderboardError) {
      console.error("[v0] Error fetching event leaderboard:", leaderboardError)
    }

    // Fetch user names for display
    const userIds = (leaderboardData || []).map((entry) => entry.user_id)
    let userNames: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from("users")
        .select("telegram_id, first_name")
        .in("telegram_id", userIds)

      if (usersData) {
        userNames = usersData.reduce(
          (acc, user) => {
            acc[user.telegram_id] = user.first_name || "Anonimo"
            return acc
          },
          {} as Record<string, string>,
        )
      }
    }

    const players = (leaderboardData || []).map((entry) => ({
      rank: entry.rank,
      user_id: entry.user_id,
      first_name: userNames[entry.user_id] || "Anonimo",
      total_pp: entry.total_pp,
      chapters_completed: entry.chapters_completed,
      last_updated: entry.last_updated,
    }))

    console.log("[v0] Event leaderboard players count:", players.length)

    let visibilityEndDate: string | null = null
    if (eventWithStatus.status === "closed_visible" && eventWithStatus.event_end_date) {
      const endDate = new Date(eventWithStatus.event_end_date)
      endDate.setDate(endDate.getDate() + 7)
      visibilityEndDate = endDate.toISOString()
    }

    return NextResponse.json(
      {
        activeEvent: {
          id: eventWithStatus.id,
          theme_key: themeKey,
          event_name: eventWithStatus.name,
          event_emoji: eventWithStatus.event_emoji || "🎮",
          pp_multiplier: eventWithStatus.pp_multiplier || 1.0,
          event_end_date: eventWithStatus.event_end_date,
          description: eventWithStatus.description,
        },
        players,
        status: eventWithStatus.status,
        visibilityEndDate,
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
