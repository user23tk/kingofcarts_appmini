import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { generateChapter, getDailyLimitStatus } from "@/lib/story/chapter-generator"

export const dynamic = "force-dynamic"

/**
 * Debug endpoint per generare un capitolo AI.
 * Protetto da requireDebugAuth — solo admin.
 * Usa generateChapter() da chapter-generator.ts (no logica duplicata).
 */
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

    const targetChapter = chapterNumber || 1

    // Check rate limit status (informational for debug)
    const limitStatus = await getDailyLimitStatus(theme)

    // Generate chapter using the centralized generator
    // (includes rate limit, lock, AI generation, image generation, DB save)
    const chapter = await generateChapter(theme, targetChapter)

    if (!chapter) {
      return NextResponse.json({
        error: "Chapter generation failed or rate limit reached",
        rateLimitStatus: limitStatus,
      }, { status: 429 })
    }

    return NextResponse.json({
      success: true,
      chapter,
      rateLimitStatus: limitStatus,
    })
  } catch (error) {
    console.error("Error generating chapter:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate chapter" },
      { status: 500 }
    )
  }
}
