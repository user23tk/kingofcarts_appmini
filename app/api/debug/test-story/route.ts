import { type NextRequest, NextResponse } from "next/server"
import { StoryManager } from "@/lib/story/story-manager"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireDebugAuth(request)
    if (!authCheck.authorized) {
      return authCheck.response!
    }

    const { theme, chapter } = await request.json()

    if (!theme || !chapter) {
      return NextResponse.json({ error: "Theme and chapter are required" }, { status: 400 })
    }

    const storyManager = new StoryManager()

    // Test loading a specific chapter
    const chapterData = await storyManager.getChapter(theme, chapter)

    if (!chapterData) {
      return NextResponse.json(
        {
          success: false,
          error: "Chapter not found",
          theme,
          chapter,
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      theme,
      chapter,
      scenes: chapterData.scenes?.length || 0,
      title: chapterData.title,
      hasChoices: chapterData.scenes?.some((scene) => scene.choices && scene.choices.length > 0) || false,
    })
  } catch (error) {
    console.error("[v0] Story test error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    )
  }
}
