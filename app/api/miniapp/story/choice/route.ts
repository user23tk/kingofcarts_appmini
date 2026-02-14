import { type NextRequest, NextResponse } from "next/server"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"
import { PPValidator } from "@/lib/security/pp-validator"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"
import { requireTelegramAuth } from "@/lib/miniapp/auth-middleware"
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

  // Rate limit check
  const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
  const userAgent = request.headers.get("user-agent") || undefined

  const securityCheck = await MiniAppSecurity.validateRequest(
    userId,
    "STORY_CHOICE",
    "story/choice",
    ipAddress,
    userAgent,
  )

  if (!securityCheck.success) {
    // Include burst information in the response
    return NextResponse.json(
      {
        error: securityCheck.error,
        code: securityCheck.isBurst ? "BURST_LIMIT" : "RATE_LIMIT_EXCEEDED",
        isBurst: securityCheck.isBurst,
        resetTime: securityCheck.resetTime,
      },
      { status: securityCheck.status }
    )
  }

  try {
    const { theme, chapterNumber, sceneIndex, choiceId } = auth.body || {}

    if (!theme || chapterNumber === undefined || sceneIndex === undefined || !choiceId) {
      console.warn("miniapp-story-choice", "Missing required fields", { theme, chapterNumber, sceneIndex, choiceId })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const storyManager = new StoryManager()
    const sessionManager = new SessionManager()

    const themeProgress = await storyManager.getThemeProgress(userId, theme)
    const availableChapters = await storyManager.getAvailableChaptersCount(theme)

    // Se tutti i capitoli pre-esistenti sono stati completati,
    // controlla solo se il limite giornaliero di generazione è stato raggiunto.
    // getChapter() si occuperà di generare dinamicamente i capitoli mancanti.
    if (themeProgress.completed || themeProgress.current_chapter > availableChapters) {
      const limitStatus = await storyManager.getDailyLimitStatus(theme)
      if (!limitStatus.allowed) {
        console.log("miniapp-story-choice", "Daily generation limit reached", {
          userId,
          theme,
          currentChapter: themeProgress.current_chapter,
          availableChapters,
        })
        return NextResponse.json(
          {
            error: limitStatus.message,
            code: "DAILY_LIMIT_REACHED",
            waiting: true,
          },
          { status: 429 },
        )
      }
    }

    if (chapterNumber !== themeProgress.current_chapter) {
      console.warn("miniapp-story-choice", "Chapter mismatch", {
        userId,
        requestedChapter: chapterNumber,
        currentChapter: themeProgress.current_chapter,
      })
      return NextResponse.json(
        {
          error: "Capitolo non valido. Ricarica la pagina.",
          code: "CHAPTER_MISMATCH",
        },
        { status: 400 },
      )
    }

    console.debug("miniapp-story-choice", "Processing choice", { userId, theme, chapterNumber, sceneIndex, choiceId })

    const session = sessionManager.getSession(userId)
    if (!session) {
      console.warn("miniapp-story-choice", "Session not found", { userId })
      return NextResponse.json({ error: "Session expired. Please restart the story." }, { status: 400 })
    }

    const chapter = await storyManager.getChapter(theme, chapterNumber)
    if (!chapter) {
      console.warn("miniapp-story-choice", "Chapter not found", { theme, chapterNumber })
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    }

    const currentScene = chapter.scenes[sceneIndex]
    if (!currentScene) {
      console.warn("miniapp-story-choice", "Invalid scene", { sceneIndex, totalScenes: chapter.scenes.length })
      return NextResponse.json({ error: "Invalid scene" }, { status: 400 })
    }

    // ==========================================
    // STEP 2: Determina tipo scena
    // ==========================================
    const hasChoices = currentScene.choices && currentScene.choices.length > 0
    const isNarrativeScene = !hasChoices

    console.debug("miniapp-story-choice", "Scene type analyzed", {
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
        console.warn("miniapp-story-choice", "Invalid continue on choice scene", {
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

      console.debug("miniapp-story-choice", "Valid continue on narrative scene", {
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
        console.warn("miniapp-story-choice", "Invalid choice on narrative scene", {
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
        console.warn("miniapp-story-choice", "Invalid choice ID", {
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
        console.warn("miniapp-story-choice", "Invalid PP delta detected", {
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
      console.debug("miniapp-story-choice", "Valid choice with PP", {
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
      console.error("miniapp-story-choice", "Failed to update session", { userId })
      return NextResponse.json({ error: "Session error" }, { status: 500 })
    }

    await sessionManager.incrementInteractionCount()

    const nextSceneIndex = sceneIndex + 1
    const isLastScene = nextSceneIndex >= chapter.scenes.length

    if (isLastScene) {
      const totalPP = updatedSession.ppAccumulated

      // Calculate multiplier BEFORE completing chapter so the stored value is correct if intended (or just to display correct value)
      // Wait, if the DB stores base PP and leaderboard uses base PP, then we shouldn't multiply stored value. 
      // But the logs say "PP Gained: 20" (multiplied) while choice was +6.
      // If the intent is to AWARD multiplied PP, we must multiply BEFORE adding to DB.

      const multiplier = await import("@/lib/story/event-manager").then((m) => m.EventManager.getPPMultiplier(theme))
      const finalPPEarned = Math.floor(totalPP * multiplier)

      await storyManager.completeChapter(userId, theme, finalPPEarned) // Save FINAL amount

      sessionManager.clearSession(userId)

      QueryCache.invalidate(`user_progress:${userId}`)
      QueryCache.invalidate(`telegram_user:${telegramUser.id}`)

      const progress = await storyManager.getUserProgress(userId)

      console.info("miniapp-story-choice", "Chapter completed", { userId, theme, ppEarned: finalPPEarned })

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
      console.error("miniapp-story-choice", "Invalid chapter structure - missing next scene", { nextSceneIndex })
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
        background_image_url: nextScene.background_image_url,
        video_url: nextScene.video_url,
      },
      ppEarned: ppDelta,
      sessionPP: updatedSession.ppAccumulated,
      totalPP: progress?.total_pp || 0,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error("miniapp-story-choice", "Error processing choice", {
      error: errorMessage,
      stack: errorStack,
      userId,
    })
    return NextResponse.json({ error: "Failed to process choice" }, { status: 500 })
  }
}
