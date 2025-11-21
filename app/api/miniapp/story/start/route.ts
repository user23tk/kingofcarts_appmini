import { type NextRequest, NextResponse } from "next/server"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"
import { AdvancedRateLimiter } from "@/lib/security/rate-limiter"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"
import { validateTelegramWebAppData, extractUserFromInitData } from "@/lib/telegram/webapp-auth"
import { TelegramBot } from "@/lib/telegram/bot"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData, theme } = body

    console.log("[v0] Story start API called for theme:", theme)

    if (!initData) {
      return NextResponse.json({ error: "Missing initData" }, { status: 400 })
    }

    const validation = validateTelegramWebAppData(initData)
    if (!validation.valid || !validation.data) {
      console.error("[v0] Invalid Telegram auth:", validation.error)
      return NextResponse.json({ error: validation.error || "Invalid authentication" }, { status: 401 })
    }

    const telegramUser = extractUserFromInitData(validation.data)
    if (!telegramUser) {
      return NextResponse.json({ error: "User data not found" }, { status: 401 })
    }

    const bot = new TelegramBot()
    const user = await bot.getOrCreateUser({
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      language_code: telegramUser.language_code,
      is_bot: false,
    })

    if (!user) {
      return NextResponse.json({ error: "Failed to get user" }, { status: 500 })
    }

    const userId = user.id

    const inputValidation = MiniAppSecurity.validateInput({ theme })
    if (!inputValidation.valid) {
      return NextResponse.json({ error: inputValidation.error }, { status: 400 })
    }

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    const securityCheck = await MiniAppSecurity.validateRequest(
      userId,
      "START_STORY",
      `story/${theme}`,
      ipAddress,
      userAgent,
    )

    if (!securityCheck.success) {
      return NextResponse.json({ error: securityCheck.error }, { status: securityCheck.status })
    }

    const rateLimitResult = await AdvancedRateLimiter.checkRateLimit(userId, undefined, false)
    if (!rateLimitResult.allowed) {
      console.log("[v0] Rate limit exceeded for user:", userId)
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          reason: rateLimitResult.reason,
          resetTime: rateLimitResult.resetTime,
        },
        { status: 429 },
      )
    }

    const storyManager = new StoryManager()
    const sessionManager = new SessionManager()

    const isValid = await storyManager.isValidTheme(theme)
    if (!isValid) {
      console.error("[v0] Invalid theme:", theme)
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 })
    }

    let progress = await storyManager.getUserProgress(userId)
    if (!progress) {
      console.log("[v0] Creating new user progress")
      progress = await storyManager.createUserProgress(userId, theme)
    }

    await storyManager.updateCurrentTheme(userId, theme)

    const themeProgress = await storyManager.getThemeProgress(userId, theme)
    const chapterNumber = themeProgress.current_chapter

    console.log("[v0] Loading chapter:", chapterNumber, "for theme:", theme)

    const chapter = await storyManager.getChapter(theme, chapterNumber)
    if (!chapter) {
      console.error("[v0] Chapter not found:", { theme, chapterNumber })
      return NextResponse.json(
        { error: `Chapter ${chapterNumber} not found for theme ${theme}. Please add chapters to the database.` },
        { status: 404 },
      )
    }

    console.log("[v0] Chapter loaded:", {
      title: chapter.title,
      scenesCount: chapter.scenes?.length,
      firstSceneExists: !!chapter.scenes?.[0],
    })

    if (!chapter.scenes || chapter.scenes.length === 0) {
      console.error("[v0] Chapter has no scenes:", chapter)
      return NextResponse.json(
        { error: `Chapter ${chapterNumber} for theme ${theme} has no scenes. Please check the database.` },
        { status: 500 },
      )
    }

    const session = sessionManager.createSession(userId)
    await sessionManager.incrementInteractionCount()

    const firstScene = chapter.scenes[0]
    console.log("[v0] First scene:", {
      index: firstScene.index,
      textLength: firstScene.text?.length,
      hasChoices: !!firstScene.choices,
      choicesCount: firstScene.choices?.length,
    })

    if (typeof firstScene.index !== "number" || !firstScene.text) {
      console.error("[v0] Invalid first scene structure:", firstScene)
      return NextResponse.json({ error: "Invalid scene structure in database" }, { status: 500 })
    }

    await AdvancedRateLimiter.checkRateLimit(userId, undefined, true)

    const response = {
      success: true,
      chapterNumber,
      chapterTitle: chapter.title,
      scene: {
        index: firstScene.index,
        text: storyManager.formatStoryText(firstScene.text, "Player", progress.total_pp || 0),
        choices: firstScene.choices || null,
      },
      sessionPP: 0,
      totalPP: progress.total_pp || 0,
    }

    console.log(
      "[v0] Returning story data - scene index:",
      response.scene.index,
      "has choices:",
      !!response.scene.choices,
    )

    return NextResponse.json(response)
  } catch (error) {
    console.error("[v0] Error starting story:", error)
    return NextResponse.json(
      {
        error: "Failed to start story",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
