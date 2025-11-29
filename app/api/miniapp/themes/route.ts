import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Fetch themes with chapter counts using aggregation
    // Exclude expired events (is_event=true but event_end_date < now)
    const { data: themesData, error: themesError } = await supabase
      .from("themes")
      .select(
        "id, name, title, description, emoji, is_active, total_chapters, is_event, event_end_date, event_start_date",
      )
      .eq("is_active", true)
      .order("name")

    if (themesError) {
      console.error("[v0] Error fetching themes:", themesError)
      return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 })
    }

    const now = new Date()
    const filteredThemes = (themesData || []).filter((theme) => {
      // If not an event, always include
      if (!theme.is_event) {
        return true
      }

      // For events: check if not expired and has started
      const hasStarted = !theme.event_start_date || new Date(theme.event_start_date) <= now
      const notExpired = !theme.event_end_date || new Date(theme.event_end_date) > now

      return hasStarted && notExpired
    })

    // For each theme, count active chapters
    const themesWithCounts = await Promise.all(
      filteredThemes.map(async (theme) => {
        const { count, error: countError } = await supabase
          .from("story_chapters")
          .select("*", { count: "exact", head: true })
          .eq("theme_id", theme.id)
          .eq("is_active", true)

        if (countError) {
          console.error(`[v0] Error counting chapters for theme ${theme.id}:`, countError)
        }

        return {
          id: theme.name, // Use theme.name as the ID for routing
          name: theme.title || theme.name,
          description: theme.description || "",
          emoji: theme.emoji || "📖",
          chapterCount: count || 0,
          isEvent: theme.is_event || false,
          eventEndDate: theme.event_end_date,
        }
      }),
    )

    return NextResponse.json({
      success: true,
      themes: themesWithCounts,
    })
  } catch (error) {
    console.error("[v0] Error in themes API:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch themes",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
