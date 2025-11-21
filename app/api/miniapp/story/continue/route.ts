import { type NextRequest, NextResponse } from "next/server"
import { SessionManager } from "@/lib/story/session-manager"
import { StoryManager } from "@/lib/story/story-manager"
import { validateTelegramWebAppData } from "@/lib/telegram/webapp-auth"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData, theme } = body

    const validation = await validateTelegramWebAppData(initData)
    if (!validation.isValid || !validation.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = validation.user.id.toString()

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    const securityCheck = await MiniAppSecurity.validateRequest(
      userId,
      "CONTINUE_STORY",
      `story/${theme}`,
      ipAddress,
      userAgent,
    )

    if (!securityCheck.success) {
      return NextResponse.json({ error: securityCheck.error }, { status: securityCheck.status })
    }

    const inputValidation = MiniAppSecurity.validateInput({ userId, theme })
    if (!inputValidation.valid) {
      return NextResponse.json({ error: inputValidation.error }, { status: 400 })
    }

    const sessionManager = new SessionManager()
    const storyManager = new StoryManager()

    const session = sessionManager.getSession(userId)

    if (!session) {
      return NextResponse.json({
        hasActiveSession: false,
      })
    }

    const themeProgress = await storyManager.getThemeProgress(userId, theme)
    const progress = await storyManager.getUserProgress(userId)

    return NextResponse.json({
      hasActiveSession: true,
      chapterNumber: themeProgress.current_chapter,
      currentScene: session.currentScene,
      sessionPP: session.ppAccumulated,
      totalPP: progress?.total_pp || 0,
    })
  } catch (error) {
    console.error("[v0] Error checking session:", error)
    return NextResponse.json({ error: "Failed to check session" }, { status: 500 })
  }
}
