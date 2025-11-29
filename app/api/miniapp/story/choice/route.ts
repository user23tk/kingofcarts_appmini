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

    // Previously: 2 calls (check without count, then count after success)
    // Now: 1 call that checks AND counts atomically
    const rateLimitCheck = await AdvancedRateLimiter.checkRateLimit(userId, undefined, true)
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

    // ==========================================
    // STEP 2: Determina tipo scena
    // ==========================================
    const hasChoices = currentScene.choices && currentScene.choices.length > 0
    const isNarrativeScene = !hasChoices

    logger.debug("miniapp-story-choice", "Scene type analyzed", {
      sceneIndex,
      isNarrativeScene,
      hasChoices,
      choiceCount: currentScene.choices?.length || 0,
      receivedChoiceId: choiceId,
      userId,
    })

    // ==========================================
    // STEP 3: Validazione e PP calculation
    // ==========================================
    let ppDelta = 0
    let selectedChoice = null

    if (choiceId === "continue") {
      // ------------------------------------------------
      // CASE A: "continue" action
      // ------------------------------------------------

      if (!isNarrativeScene) {
        // ERROR: "continue" su scena con scelte
        logger.warn("miniapp-story-choice", "Invalid continue on choice scene", {
          userId,
          theme,
          chapterNumber,
          sceneIndex,
          availableChoices: currentScene.choices?.map((c) => c.id),
        })

        return NextResponse.json(
          {
            error: "This scene requires a choice",
            code: "INVALID_CONTINUE_ON_CHOICE_SCENE",
            details: {
              sceneType: "choice",
              expectedAction: "select_choice",
              availableChoices: currentScene.choices?.map((c) => ({
                id: c.id,
                label: c.label,
                pp_delta: c.pp_delta,
              })),
            },
          },
          { status: 400 },
        )
      }

      // VALID: "continue" su scena narrativa
      ppDelta = 0

      logger.debug("miniapp-story-choice", "Valid continue on narrative scene", {
        userId,
        sceneIndex,
        ppDelta: 0,
      })
    } else {
      // ------------------------------------------------
      // CASE B: Choice action (A, B, C, ...)
      // ------------------------------------------------

      if (isNarrativeScene) {
        // ERROR: Choice su scena narrativa
        logger.warn("miniapp-story-choice", "Invalid choice on narrative scene", {
          userId,
          theme,
          chapterNumber,
          sceneIndex,
          attemptedChoiceId: choiceId,
        })

        return NextResponse.json(
          {
            error: "This scene has no choices",
            code: "INVALID_CHOICE_ON_NARRATIVE_SCENE",
            details: {
              sceneType: "narrative",
              expectedAction: "continue",
              hint: "Narrative scenes advance automatically. Use 'continue' action.",
            },
          },
          { status: 400 },
        )
      }

      // Trova la choice selezionata
      selectedChoice = currentScene.choices!.find((c) => c.id === choiceId)

      if (!selectedChoice) {
        // ERROR: Choice ID non esistente
        logger.warn("miniapp-story-choice", "Invalid choice ID", {
          userId,
          choiceId,
          availableChoices: currentScene.choices?.map((c) => c.id),
          sceneIndex,
        })

        return NextResponse.json(
          {
            error: "Invalid choice",
            code: "CHOICE_NOT_FOUND",
            details: {
              attemptedChoiceId: choiceId,
              availableChoices: currentScene.choices?.map((c) => ({
                id: c.id,
                label: c.label,
              })),
            },
          },
          { status: 400 },
        )
      }

      // Estrai PP dalla choice
      ppDelta = selectedChoice.pp_delta || 0

      // Valida PP con PPValidator
      const validation_result = PPValidator.validateChoice(currentScene.choices || [], choiceId, ppDelta)

      if (!validation_result.isValid) {
        // ERROR: PP non valido (cheating attempt?)
        logger.warn("miniapp-story-choice", "Invalid PP delta detected", {
          userId,
          choiceId,
          ppDelta,
          reason: validation_result.reason,
          sceneIndex,
        })

        return NextResponse.json(
          {
            error: "Invalid PP value",
            code: "INVALID_PP_VALUE",
            details: {
              reason: validation_result.reason,
            },
          },
          { status: 400 },
        )
      }

      // VALID: Choice con PP corretto
      logger.debug("miniapp-story-choice", "Valid choice with PP", {
        userId,
        choiceId,
        ppDelta,
        sceneIndex,
      })
    }

    // ==========================================
    // STEP 4: Aggiorna sessione
    // ==========================================
    const updatedSession = sessionManager.updateSession(userId, {
      currentScene: sceneIndex + 1,
      ppAccumulated: session.ppAccumulated + ppDelta,
    })

    if (!updatedSession) {
      logger.error("miniapp-story-choice", "Failed to update session", { userId })
      return NextResponse.json({ error: "Session error" }, { status: 500 })
    }

    await sessionManager.incrementInteractionCount()

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
