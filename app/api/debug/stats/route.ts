import { type NextRequest, NextResponse } from "next/server"
import { StoryManager } from "@/lib/story/story-manager"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  try {
    const storyManager = new StoryManager()
    const stats = await storyManager.getGlobalStats()

    return NextResponse.json(stats)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("debug-stats", "Failed to fetch stats", { error: errorMessage })
    return NextResponse.json(
      {
        error: "Failed to fetch stats",
        details: errorMessage,
      },
      { status: 500 },
    )
  }
}
