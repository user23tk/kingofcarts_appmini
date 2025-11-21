import { type NextRequest, NextResponse } from "next/server"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"
import { PPValidator } from "@/lib/security/pp-validator"
import { validateTelegramWebAppData, extractUserFromInitData } from "@/lib/telegram/webapp-auth"
import { AdvancedRateLimiter } from "@/lib/security/rate-limiter"
import { TelegramBot } from "@/lib/telegram/bot"
import { QueryCache } from "@/lib/cache/query-cache"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData, theme, chapterNumber, sceneIndex, choiceId } = body

    const validation = validateTelegramWebAppData(initData)
    if (!validation.valid || !validation.data) {
      console.error("[v0] Invalid Telegram auth:", validation.error)
      return NextResponse.json({ error: validation.error || "Unauthorized" }, { status: 401 })
    }

    const telegramUser = extractUserFromInitData(validation.data)
    if (!telegramUser) {
      return NextResponse.json({ error: "User data not found" }, { status: 401 })
    }

    const bot = new TelegramBot()
    const user = await QueryCache.get(
      `telegram_user:${telegramUser.id}`,
      async () => {
        return await bot.getOrCreateUser({
          id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          language_code: telegramUser.language_code,
          is_bot: false,
        })
      },
      60, // Cache for 1 minute
    )

    if (!user) {
      return NextResponse.json({ error: "Failed to get user" }, { status: 500 })
    }

    const userId = user.id

    const rateLimitResult = await AdvancedRateLimiter.checkRateLimit(userId, undefined, false)
    if (!rateLimitResult.allowed) {
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

    console.log("[v0] Processing choice:", { userId, theme, chapterNumber, sceneIndex, choiceId })

    const session = sessionManager.getSession(userId)
    if (!session) {
      return NextResponse.json({ error: "Session expired. Please restart the story." }, { status: 400 })
    }

    const chapter = await storyManager.getChapter(theme, chapterNumber)
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    }

    const currentScene = chapter.scenes[sceneIndex]
    if (!currentScene) {
      return NextResponse.json({ error: "Invalid scene" }, { status: 400 })
    }

    let ppDelta = 0

    if (choiceId === "continue") {
      ppDelta = 0
    } else {
      const selectedChoice = currentScene.choices?.find((c) => c.id === choiceId)
      if (!selectedChoice) {
        return NextResponse.json({ error: "Invalid choice" }, { status: 400 })
      }

      ppDelta = selectedChoice.pp_delta || 0

      const validation_result = PPValidator.validateChoice(currentScene.choices || [], choiceId, ppDelta)
      if (!validation_result.isValid) {
        console.error("[SECURITY] Invalid PP delta:", validation_result.reason)
        return NextResponse.json({ error: "Invalid PP value" }, { status: 400 })
      }
    }

    const updatedSession = sessionManager.updateSession(userId, {
      currentScene: sceneIndex + 1,
      ppAccumulated: session.ppAccumulated + ppDelta,
    })

    if (!updatedSession) {
      return NextResponse.json({ error: "Session error" }, { status: 500 })
    }

    await sessionManager.incrementInteractionCount()

    await AdvancedRateLimiter.checkRateLimit(userId, undefined, true)

    const nextSceneIndex = sceneIndex + 1
    const isLastScene = nextSceneIndex >= chapter.scenes.length

    if (isLastScene) {
      const totalPP = updatedSession.ppAccumulated
      await storyManager.completeChapter(userId, theme, totalPP)

      sessionManager.clearSession(userId)

      QueryCache.invalidate(`user_progress:${userId}`)
      QueryCache.invalidate(`telegram_user:${telegramUser.id}`)

      const progress = await storyManager.getUserProgress(userId)

      const multiplier = await import("@/lib/story/event-manager").then((m) => m.EventManager.getPPMultiplier(theme))
      const finalPPEarned = Math.floor(totalPP * multiplier)

      return NextResponse.json({
        success: true,
        completed: true,
        finale: {
          text: storyManager.formatStoryText(
            chapter.finale.text,
            telegramUser.first_name || telegramUser.username || "Player",
            progress?.total_pp || 0,
          ),
        },
        ppEarned: finalPPEarned,
        totalPP: progress?.total_pp || 0,
        nextChapter: chapter.finale.nextChapter,
      })
    }

    const nextScene = chapter.scenes[nextSceneIndex]
    if (!nextScene) {
      return NextResponse.json({ error: "Invalid chapter structure" }, { status: 500 })
    }

    const progress = await storyManager.getUserProgress(userId)

    return NextResponse.json({
      success: true,
      completed: false,
      nextScene: {
        index: nextScene.index,
        text: storyManager.formatStoryText(
          nextScene.text,
          telegramUser.first_name || telegramUser.username || "Player",
          progress?.total_pp,
        ),
        choices: nextScene.choices || null,
      },
      ppEarned: ppDelta,
      sessionPP: updatedSession.ppAccumulated,
      totalPP: progress?.total_pp || 0,
    })
  } catch (error) {
    console.error("[v0] Error processing choice:", error)
    return NextResponse.json({ error: "Failed to process choice" }, { status: 500 })
  }
}
