import { NextResponse } from "next/server"
import { StoryManager } from "@/lib/story/story-manager"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const storyManager = new StoryManager()
    const stats = await storyManager.getGlobalStats()

    return NextResponse.json(stats)
  } catch (error) {
    console.error("[v0] Debug stats error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
