import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { validateChapterStructure } from "@/lib/schemas/chapter-schema"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDebugAuth(request)
    if (!auth.authorized) {
      return auth.response!
    }

    const { theme, chapterNumber, content } = await request.json()

    // Validate input
    if (!theme || !chapterNumber || !content) {
      return NextResponse.json({ error: "Theme, chapter number, and content are required" }, { status: 400 })
    }

    // Security: Validate content size (max 100KB per chapter)
    const contentStr = JSON.stringify(content)
    if (contentStr.length > 100000) {
      return NextResponse.json(
        { error: "Chapter content too large. Maximum size is 100KB." },
        { status: 400 }
      )
    }

    // Validate chapter structure with Zod
    try {
      validateChapterStructure(content)
    } catch (validationError) {
      return NextResponse.json(
        {
          error: "Invalid chapter structure",
          details: validationError instanceof Error ? validationError.message : "Validation failed",
        },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()

    // First, ensure theme exists
    const { data: existingTheme, error: themeError } = await supabase
      .from("themes")
      .select("id")
      .eq("name", theme)
      .single()

    let themeId: string

    if (themeError || !existingTheme) {
      // Create theme if it doesn't exist
      const { data: newTheme, error: createThemeError } = await supabase
        .from("themes")
        .insert({
          name: theme,
          emoji: getThemeEmoji(theme),
          description: `Capitoli del tema ${theme}`,
        })
        .select("id")
        .single()

      if (createThemeError || !newTheme) {
        console.error("[v0] Error creating theme:", createThemeError)
        return NextResponse.json({ error: "Failed to create theme" }, { status: 500 })
      }

      themeId = newTheme.id
    } else {
      themeId = existingTheme.id
    }

    const { data: existingChapter } = await supabase
      .from("story_chapters")
      .select("id, title, chapter_number, version")
      .eq("theme_id", themeId)
      .eq("chapter_number", chapterNumber)
      .single()

    const { data: chapter, error: chapterError } = await supabase
      .from("story_chapters")
      .upsert(
        {
          theme_id: themeId,
          chapter_number: chapterNumber,
          title: content.title || `Capitolo ${chapterNumber}`,
          content: content,
          is_active: true,
          version: existingChapter ? (existingChapter.version || 1) + 1 : 1,
        },
        {
          onConflict: "theme_id,chapter_number",
        },
      )
      .select()
      .single()

    if (chapterError) {
      console.error("[v0] Error saving chapter:", chapterError)
      return NextResponse.json(
        {
          error: "Failed to save chapter to database",
          details: chapterError.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: existingChapter ? "Chapter updated successfully" : "Chapter created successfully",
      isUpdate: !!existingChapter,
      chapter: {
        id: chapter.id,
        theme: theme,
        chapterNumber: chapterNumber,
        title: chapter.title,
      },
    })
  } catch (error) {
    console.error("[v0] Error in chapters API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDebugAuth(request)
    if (!auth.authorized) {
      return auth.response!
    }

    const { searchParams } = new URL(request.url)
    const theme = searchParams.get("theme")

    const supabase = createAdminClient()

    let query = supabase
      .from("story_chapters")
      .select(`
        id,
        chapter_number,
        title,
        content,
        is_active,
        created_at,
        themes (
          name,
          emoji
        )
      `)
      .eq("is_active", true)
      .order("chapter_number", { ascending: true })

    if (theme) {
      // Filter by theme if specified
      const { data: themeData } = await supabase.from("themes").select("id").eq("name", theme).single()

      if (themeData) {
        query = query.eq("theme_id", themeData.id)
      } else {
        // If theme is specified but not found, return empty list instead of all chapters
        return NextResponse.json({
          success: true,
          chapters: [],
        })
      }
    }

    const { data: chapters, error } = await query

    if (error) {
      console.error("[v0] Error fetching chapters:", error)
      return NextResponse.json({ error: "Failed to fetch chapters" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      chapters: chapters || [],
    })
  } catch (error) {
    console.error("[v0] Error in chapters GET API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function getThemeEmoji(theme: string): string {
  const emojiMap: Record<string, string> = {
    fantasy: "🧙‍♂️",
    "sci-fi": "🚀",
    mystery: "🔍",
    romance: "💕",
    adventure: "⚔️",
    horror: "👻",
    comedy: "😄",
  }
  return emojiMap[theme] || "📖"
}
