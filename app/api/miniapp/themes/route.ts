import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    await supabase.rpc("deactivate_expired_events")

    const { data: themesData, error: themesError } = await supabase
      .from("themes")
      .select("id, name, title, description, emoji, is_active, total_chapters, is_event")
      .eq("is_active", true)
      .eq("is_event", false) // Exclude event themes from story list
      .order("name")

    if (themesError) {
      console.error("[v0] Error fetching themes:", themesError)
      return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 })
    }

    // For each theme, count active chapters
    const themesWithCounts = await Promise.all(
      (themesData || []).map(async (theme) => {
        const { count, error: countError } = await supabase
          .from("story_chapters")
          .select("*", { count: "exact", head: true })
          .eq("theme_id", theme.id)
          .eq("is_active", true)

        if (countError) {
          console.error(`[v0] Error counting chapters for theme ${theme.id}:`, countError)
        }

        return {
          id: theme.name,
          name: theme.title || theme.name,
          description: theme.description || "",
          emoji: theme.emoji || "📖",
          chapterCount: count || 0,
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
