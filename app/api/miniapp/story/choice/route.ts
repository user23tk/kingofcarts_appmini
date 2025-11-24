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
    const body = await request.json()
    const { theme, chapterNumber, sceneIndex, choiceId } = body

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

    logger.debug("miniapp-story-choice", "Processing choice", { userId, theme, chapterNumber, sceneIndex, choiceId })

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
        logger.warn("miniapp-story-choice", "Invalid PP delta detected", { reason: validation_result.reason })
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
    logger.error("miniapp-story-choice", "Error processing choice", { error, userId })
    return NextResponse.json({ error: "Failed to process choice" }, { status: 500 })
  }
}
