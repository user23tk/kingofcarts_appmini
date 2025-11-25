import { type NextRequest, NextResponse } from "next/server"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"
import { PPValidator } from "@/lib/security/pp-validator"
import { requireTelegramAuth } from "@/lib/miniapp/auth-middleware"
import { AdvancedRateLimiter } from "@/lib/security/rate-limiter"
import { logger } from "@/lib/debug/logger"
import { QueryCache } from "@/lib/cache/query-cache"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireTelegramAuth(request)
  if (!auth.authorized) return auth.response

  const userId = auth.userId!
  const telegramUser = {
    id: auth.telegramId!,
    username: auth.username,
    first_name: auth.firstName,
  }

  try {
    const { theme, chapterNumber, sceneIndex, choiceId } = auth.body || {}

    if (!theme || chapterNumber === undefined || sceneIndex === undefined || !choiceId) {
      logger.warn("miniapp-story-choice", "Missing required fields", { theme, chapterNumber, sceneIndex, choiceId })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const rateLimitCheck = await AdvancedRateLimiter.checkRateLimit(userId, undefined, false)
    if (!rateLimitCheck.allowed) {
      logger.warn("miniapp-story-choice", "Rate limit exceeded", { userId, reason: rateLimitCheck.reason })
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          reason: rateLimitCheck.reason,
          resetTime: rateLimitCheck.resetTime,
        },
        { status: 429 },
      )
    }

    const storyManager = new StoryManager()
    const sessionManager = new SessionManager()

    logger.debug("miniapp-story-choice", "Processing choice", { userId, theme, chapterNumber, sceneIndex, choiceId })

    const session = sessionManager.getSession(userId)
    if (!session) {
      logger.warn("miniapp-story-choice", "Session not found", { userId })
      return NextResponse.json({ error: "Session expired. Please restart the story." }, { status: 400 })
    }

    const chapter = await storyManager.getChapter(theme, chapterNumber)
    if (!chapter) {
      logger.warn("miniapp-story-choice", "Chapter not found", { theme, chapterNumber })
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    }

    const currentScene = chapter.scenes[sceneIndex]
    if (!currentScene) {
      logger.warn("miniapp-story-choice", "Invalid scene", { sceneIndex, totalScenes: chapter.scenes.length })
      return NextResponse.json({ error: "Invalid scene" }, { status: 400 })
    }

    let ppDelta = 0

    if (choiceId === "continue") {
      ppDelta = 0
    } else {
      const selectedChoice = currentScene.choices?.find((c) => c.id === choiceId)
      if (!selectedChoice) {
        logger.warn("miniapp-story-choice", "Invalid choice", {
          choiceId,
          availableChoices: currentScene.choices?.map((c) => c.id),
        })
        return NextResponse.json({ error: "Invalid choice" }, { status: 400 })
      }

      ppDelta = selectedChoice.pp_delta || 0

      const validation_result = PPValidator.validateChoice(currentScene.choices || [], choiceId, ppDelta)
      if (!validation_result.isValid) {
        logger.warn("miniapp-story-choice", "Invalid PP delta detected", { reason: validation_result.reason })
        return NextResponse.json({ error: "Invalid PP value" }, { status: 400 })
      }
    }

    const updatedSession = sessionManager.updateSession(userId, {
      currentScene: sceneIndex + 1,
      ppAccumulated: session.ppAccumulated + ppDelta,
    })

    if (!updatedSession) {
      logger.error("miniapp-story-choice", "Failed to update session", { userId })
      return NextResponse.json({ error: "Session error" }, { status: 500 })
    }

    await sessionManager.incrementInteractionCount()

    await AdvancedRateLimiter.checkRateLimit(userId, undefined, true)
    logger.debug("miniapp-story-choice", "Rate limit incremented", { userId })

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

      logger.info("miniapp-story-choice", "Chapter completed", { userId, theme, ppEarned: finalPPEarned })

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
      logger.error("miniapp-story-choice", "Invalid chapter structure - missing next scene", { nextSceneIndex })
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
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error("miniapp-story-choice", "Error processing choice", {
      error: errorMessage,
      stack: errorStack,
      userId,
    })
    return NextResponse.json({ error: "Failed to process choice" }, { status: 500 })
  }
}
