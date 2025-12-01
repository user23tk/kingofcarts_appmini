import { type NextRequest, NextResponse } from "next/server"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"
import { AdvancedRateLimiter } from "@/lib/security/rate-limiter"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"
import { requireTelegramAuth } from "@/lib/miniapp/auth-middleware"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request)
    if (!auth.authorized) return auth.response

    const { theme } = auth.body || {}

    console.debug("miniapp-story-start", "Story start API called", { theme })

    const userId = auth.userId!
    const telegramUser = {
      id: auth.telegramId!,
      username: auth.username,
      first_name: auth.firstName,
    }

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

    // const rateLimitResult = await AdvancedRateLimiter.checkRateLimit(userId, undefined, false)
    // if (!rateLimitResult.allowed) {
    //   console.warn("miniapp-story-start", "Rate limit exceeded", { userId })
    //   return NextResponse.json(
    //     {
    //       error: "Rate limit exceeded",
    //       reason: rateLimitResult.reason,
    //       resetTime: rateLimitResult.resetTime,
    //     },
    //     { status: 429 },
    //   )
    // }

    const storyManager = new StoryManager()
    const sessionManager = new SessionManager()

    const isValid = await storyManager.isValidTheme(theme)
    if (!isValid) {
      console.error("miniapp-story-start", "Invalid theme", { theme })

      // Check if it's an event theme without chapters yet
      const { EventManager } = await import("@/lib/story/event-manager")
      const isEventTheme = await EventManager.isEventTheme(theme)

      if (isEventTheme) {
        return NextResponse.json({
          error: "Event in preparazione! I capitoli per questo contest verranno pubblicati a breve. Torna presto! 🎄",
          code: "EVENT_NOT_READY"
        }, { status: 400 })
      }

      return NextResponse.json({ error: "Invalid theme" }, { status: 400 })
    }

    let progress = await storyManager.getUserProgress(userId)
    if (!progress) {
      console.debug("miniapp-story-start", "Creating new user progress")
      progress = await storyManager.createUserProgress(userId, theme)
    }

    await storyManager.updateCurrentTheme(userId, theme)

    const themeProgress = await storyManager.getThemeProgress(userId, theme)
    const chapterNumber = themeProgress.current_chapter

    const availableChapters = await storyManager.getAvailableChaptersCount(theme)

    console.debug("miniapp-story-start", "Chapter check", {
      requestedChapter: chapterNumber,
      availableChapters,
      themeCompleted: themeProgress.completed,
    })

    if (chapterNumber > availableChapters) {
      console.info("miniapp-story-start", "User completed all available chapters", { userId, theme })
      return NextResponse.json(
        {
          success: false,
          waiting: true,
          message: `Hai completato tutti i ${availableChapters} capitoli disponibili per questo tema! 🎉\n\nNuovi capitoli verranno aggiunti presto. Torna a controllare più tardi!`,
          completedChapters: availableChapters,
          theme,
        },
        { status: 200 },
      )
    }

    console.debug("miniapp-story-start", "Loading chapter", { chapterNumber, theme })

    const chapter = await storyManager.getChapter(theme, chapterNumber)
    if (!chapter) {
      console.error("miniapp-story-start", "Chapter not found", { theme, chapterNumber })
      return NextResponse.json(
        { error: `Chapter ${chapterNumber} not found for theme ${theme}. Please add chapters to the database.` },
        { status: 404 },
      )
    }

    if (!chapter.scenes || chapter.scenes.length === 0) {
      console.error("miniapp-story-start", "Chapter has no scenes", { theme, chapterNumber })
      return NextResponse.json(
        { error: `Chapter ${chapterNumber} for theme ${theme} has no scenes. Please check the database.` },
        { status: 500 },
      )
    }

    const session = sessionManager.createSession(userId)
    await sessionManager.incrementInteractionCount()

    const firstScene = chapter.scenes[0]

    if (typeof firstScene.index !== "number" || !firstScene.text) {
      console.error("miniapp-story-start", "Invalid first scene structure", { theme, chapterNumber })
      return NextResponse.json({ error: "Invalid scene structure in database" }, { status: 500 })
    }

    // await AdvancedRateLimiter.checkRateLimit(userId, undefined, true)

    const response = {
      success: true,
      chapterNumber,
      chapterTitle: chapter.title,
      scene: {
        index: firstScene.index,
        text: storyManager.formatStoryText(
          firstScene.text,
          telegramUser.first_name || "Player",
          progress.total_pp || 0,
        ),
        choices: firstScene.choices || null,
      },
      sessionPP: 0,
      totalPP: progress.total_pp || 0,
    }

    console.info("miniapp-story-start", "Story started successfully", { userId, theme, chapterNumber })

    return NextResponse.json(response)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("miniapp-story-start", "Error starting story", { error: errorMessage })
    return NextResponse.json(
      {
        error: "Failed to start story",
        details: errorMessage,
      },
      { status: 500 },
    )
  }
}
