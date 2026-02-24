import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { generateChapter, getDailyLimitStatus } from "@/lib/story/chapter-generator"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDebugAuth(request)
    if (!auth.authorized) {
      return auth.response!
    }

    const { theme, chapterNumber } = await request.json()

    if (!theme) {
      return NextResponse.json({ error: "Theme is required" }, { status: 400 })
    }

    // Check daily limit before attempting generation
    const limitStatus = await getDailyLimitStatus()
    if (!limitStatus.allowed) {
      return NextResponse.json(
        { error: limitStatus.message, code: "DAILY_LIMIT_REACHED" },
        { status: 429 }
      )
    }

    // Use the centralized generateChapter function
    // This handles: AI generation, image generation, DB saving, rate tracking
    const chapter = await generateChapter(theme, chapterNumber || 1)

    if (!chapter) {
      return NextResponse.json(
        { error: "Failed to generate chapter. Check server logs for details." },
        { status: 500 }
      )
    }

    // Return the clean chapter in the format stored in DB
    // (with background_image_url embedded in each scene, no image_prompt/video_prompt)
    return NextResponse.json({
      success: true,
      chapter,
      dailyLimitRemaining: limitStatus.remaining - 1,
    })
  } catch (error) {
    console.error("Error generating chapter:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate chapter" },
      { status: 500 }
    )
  }
}
