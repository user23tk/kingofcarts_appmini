import { type NextRequest, NextResponse } from "next/server"
import { TelegramBot } from "@/lib/telegram/bot"
import type { TelegramUpdate } from "@/lib/telegram/types"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"
import { AntiReplayManager } from "@/lib/security/anti-replay"
import { AdvancedRateLimiter } from "@/lib/security/rate-limiter"
import { handleStartCommand } from "@/lib/commands/start-command"
import { PPValidator } from "@/lib/security/pp-validator"
import { EventManager } from "@/lib/story/event-manager"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const bot = new TelegramBot()
const storyManager = new StoryManager()
const sessionManager = new SessionManager()

export async function POST(request: NextRequest) {
  try {
    const secretToken = request.headers.get("x-telegram-bot-api-secret-token")
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET
    const userAgent = request.headers.get("user-agent")
    const contentType = request.headers.get("content-type")

    console.log("[v0] Webhook received, secret token:", secretToken ? "present" : "missing")
    console.log("[v0] Expected token:", expectedToken ? "configured" : "missing")

    // Validate webhook token using Telegram's standard header
    if (!expectedToken || secretToken !== expectedToken) {
      console.log("[v0] Unauthorized webhook request from:", request.ip)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate request format
    if (!contentType?.includes("application/json")) {
      console.log("[v0] Invalid content type:", contentType)
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    }

    const update: TelegramUpdate = await request.json()
    console.log("[v0] Received Telegram update:", update.update_id)

    if (!update.update_id || typeof update.update_id !== "number") {
      console.log("[v0] Invalid update format")
      return NextResponse.json({ error: "Invalid update format" }, { status: 400 })
    }

    // Handle different types of updates with basic error handling
    if (update.message) {
      await handleMessageWithRecovery(update.message)
    } else if (update.callback_query) {
      await handleCallbackQueryWithRecovery(update.callback_query)
    } else if (update.inline_query) {
      await handleInlineQueryWithRecovery(update.inline_query)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[v0] Telegram webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function handleInlineQueryWithRecovery(inlineQuery: any) {
  try {
    await handleInlineQuery(inlineQuery)
  } catch (error) {
    console.error("[v0] Inline query handling error:", error)
    // Send empty results on error
    try {
      await bot.answerInlineQuery(inlineQuery.id, [])
    } catch (answerError) {
      console.error("[v0] Failed to answer inline query:", answerError)
    }
  }
}

async function handleMessageWithRecovery(message: any) {
  try {
    await handleMessage(message)
  } catch (error) {
    console.error("[v0] Message handling error:", error)
    const chatId = message.chat?.id
    if (chatId) {
      try {
        await bot.sendMessage(chatId, "❌ Si è verificato un errore. Riprova con /start")
      } catch (sendError) {
        console.error("[v0] Failed to send error message:", sendError)
      }
    }
  }
}

async function handleCallbackQueryWithRecovery(callbackQuery: any) {
  try {
    await handleCallbackQuery(callbackQuery)
  } catch (error) {
    console.error("[v0] Callback handling error:", error)
    try {
      await bot.answerCallbackQuery(callbackQuery.id, "❌ Errore. Riprova con /start")
    } catch (answerError) {
      console.error("[v0] Failed to answer callback query:", answerError)
    }
  }
}

async function handleMessage(message: any) {
  if (!message.from || message.from.is_bot) {
    return // Ignore messages from bots
  }

  console.log("[v0] Processing message from user:", message.from.id)

  // Get or create user
  const user = await bot.getOrCreateUser(message.from)
  if (!user) {
    console.error("[v0] Failed to get/create user")
    return
  }

  const rateLimitResult = await AdvancedRateLimiter.checkRateLimit(user.id, undefined, false)
  if (!rateLimitResult.allowed) {
    const currentTimeStr = rateLimitResult.currentTime
      ? rateLimitResult.currentTime.toLocaleTimeString("it-IT", { timeZone: "Europe/Amsterdam" })
      : new Date().toLocaleTimeString("it-IT", { timeZone: "Europe/Amsterdam" })

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 Menu Principale", callback_data: "show_themes" }],
        [{ text: "📊 Le Mie Statistiche", callback_data: "show_stats" }],
      ],
    }

    await bot.sendMessage(
      message.chat.id,
      `🚫 <b>Limite raggiunto!</b>\n\n${rateLimitResult.reason}\nMessaggio inviato alle: ${currentTimeStr}`,
      keyboard,
    )
    return
  }

  await AdvancedRateLimiter.checkRateLimit(user.id, undefined, true)

  // Increment interaction count
  await sessionManager.incrementInteractionCount()

  const text = message.text?.toLowerCase() || ""

  // Handle commands
  if (text.startsWith("/start")) {
    await handleStartCommand(message.chat.id, user)
  } else if (text.startsWith("/help")) {
    await handleHelpCommandInline(message.chat.id)
  } else if (text.startsWith("/stats")) {
    await handleStatsCommand(message.chat.id, user)
  } else if (text.startsWith("/continue")) {
    await handleContinueCommandInline(message.chat.id, user)
  } else if (text.startsWith("/reset")) {
    await handleResetCommandInline(message.chat.id, user)
  } else if (text.startsWith("/leaderboard")) {
    await handleLeaderboardCommandInline(message.chat.id, user)
  } else {
    // Default response for unknown messages
    await bot.sendMessage(message.chat.id, "🤔 Non ho capito quel comando. Usa /help per vedere i comandi disponibili.")
  }
}

async function handleCallbackQuery(callbackQuery: any) {
  console.log("[v0] Processing callback query:", callbackQuery.data)

  if (AntiReplayManager.isCallbackProcessed(callbackQuery.id)) {
    await bot.answerCallbackQuery(callbackQuery.id, "Azione già processata!")
    return
  }

  // Mark as processed immediately
  AntiReplayManager.markCallbackProcessed(callbackQuery.id)

  const user = await bot.getOrCreateUser(callbackQuery.from)
  if (!user) {
    await bot.answerCallbackQuery(callbackQuery.id, "Error: User not found")
    return
  }

  const rateLimitResult = await AdvancedRateLimiter.checkRateLimit(user.id, undefined, false)
  if (!rateLimitResult.allowed) {
    const keyboard = {
      inline_keyboard: [[{ text: "🏠 Menu Principale", callback_data: "show_themes" }]],
    }

    const currentTimeStr = rateLimitResult.currentTime
      ? rateLimitResult.currentTime.toLocaleTimeString("it-IT", { timeZone: "Europe/Amsterdam" })
      : new Date().toLocaleTimeString("it-IT", { timeZone: "Europe/Amsterdam" })

    // Edit the message to show rate limit with reset button
    await bot.editMessageText(
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      `🚫 <b>Limite raggiunto!</b>\n\n${rateLimitResult.reason}\nAzione tentata alle: ${currentTimeStr}`,
      keyboard,
    )

    await bot.answerCallbackQuery(callbackQuery.id, `Limite raggiunto: ${rateLimitResult.reason}`)
    return
  }

  await AdvancedRateLimiter.checkRateLimit(user.id, undefined, true)

  // Increment interaction count
  await sessionManager.incrementInteractionCount()

  const data = callbackQuery.data

  if (data?.startsWith("theme_")) {
    await handleThemeSelection(callbackQuery, user)
  } else if (data?.startsWith("choice_")) {
    await handleStoryChoice(callbackQuery, user)
  } else if (data?.startsWith("continue_")) {
    await handleContinueStory(callbackQuery, user)
  } else if (data === "show_themes") {
    await handleShowThemes(callbackQuery, user)
  } else if (data === "show_stats") {
    await handleStatsCommand(callbackQuery.message.chat.id, user)
  } else if (data === "contact_support") {
    await handleContactSupport(callbackQuery, user)
  } else if (data?.startsWith("retry_")) {
    await handleRetryAction(callbackQuery, user)
  }

  await bot.answerCallbackQuery(callbackQuery.id)
}

async function handleThemeSelection(callbackQuery: any, user: any) {
  const theme = callbackQuery.data.replace("theme_", "")
  const playerName = user.first_name || "Viaggiatore"

  if (!(await storyManager.isValidTheme(theme))) {
    await bot.editMessageText(
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      "❌ Tema non valido! Riprova con /start",
    )
    return
  }

  const isEvent = await EventManager.isEventTheme(theme)
  let eventInfo = null
  if (isEvent) {
    const multiplier = await EventManager.getPPMultiplier(theme)
    eventInfo = { isEvent: true, multiplier }
    console.log(`[v0] Theme ${theme} is an active event with ${multiplier}x PP multiplier`)
  }

  const themeProgress = await storyManager.getThemeProgress(user.id, theme)

  let progress = await storyManager.getUserProgress(user.id)
  if (!progress) {
    progress = await storyManager.createUserProgress(user.id, theme)
  }

  await storyManager.updateCurrentTheme(user.id, theme)
  console.log(`[v0] Theme switched to ${theme} for user ${user.id}`)

  const themeNames = {
    fantasy: "Fantasia",
    "sci-fi": "Fantascienza",
    mystery: "Mistero",
    romance: "Romantico",
    adventure: "Avventura",
    horror: "Horror",
    comedy: "Commedia",
  }

  const progressText = themeProgress.completed
    ? "✅ Tema completato!"
    : `📖 Capitolo ${themeProgress.current_chapter} di ${themeNames[theme as keyof typeof themeNames]}`

  const eventBadge = eventInfo ? `\n\n🎉 <b>EVENTO SPECIALE</b> - PP x${eventInfo.multiplier}! 🎉` : ""

  const selectionMessage = storyManager.formatStoryText(
    `🎯 <b>Tema ${themeNames[theme as keyof typeof themeNames]} Selezionato!</b>

${progressText}${eventBadge}

Eccellente scelta, {{PLAYER}}! {{KING}} è entusiasta di guidarti attraverso questo regno magico.

${
  themeProgress.completed
    ? "Hai già completato questo tema, ma puoi sempre rivivere l'avventura!"
    : `Sei pronto per ${themeProgress.current_chapter === 1 ? "iniziare" : "continuare dal"} Capitolo ${themeProgress.current_chapter}?`
}

L'avventura ti aspetta! ✨`,
    playerName,
  )

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: themeProgress.completed
            ? "🔄 Ricomincia Tema"
            : `▶️ ${themeProgress.current_chapter === 1 ? "Inizia" : "Continua"} Capitolo ${themeProgress.current_chapter}`,
          callback_data: `continue_${theme}`,
        },
      ],
      [{ text: "🔙 Torna ai Temi", callback_data: "show_themes" }],
    ],
  }

  await bot.editMessageText(callbackQuery.message.chat.id, callbackQuery.message.message_id, selectionMessage, keyboard)
}

async function handleStoryChoice(callbackQuery: any, user: any) {
  const choiceData = callbackQuery.data.replace("choice_", "")
  const [sceneIndex, choiceId] = choiceData.split("_")

  const session = sessionManager.getSession(user.id)
  if (!session) {
    await bot.answerCallbackQuery(callbackQuery.id, "Sessione scaduta! Usa /continue per riprendere.")
    return
  }

  const progress = await storyManager.getUserProgress(user.id)
  if (!progress) {
    await bot.answerCallbackQuery(callbackQuery.id, "Errore: progresso non trovato!")
    return
  }

  const chapter = await storyManager.getChapter(progress.current_theme, progress.current_chapter)
  if (!chapter) {
    await bot.answerCallbackQuery(callbackQuery.id, "Errore: capitolo non trovato!")
    return
  }

  const scene = chapter.scenes[Number.parseInt(sceneIndex)]
  if (!scene) {
    await bot.answerCallbackQuery(callbackQuery.id, "Errore: scena non trovata!")
    return
  }

  if (choiceId === "continue") {
    // Scene without choices - just continue to next scene
    const updatedSession = sessionManager.updateSession(user.id, {
      currentScene: session.currentScene + 1,
      ppAccumulated: session.ppAccumulated, // No PP change for continue
    })

    if (!updatedSession) {
      await bot.answerCallbackQuery(callbackQuery.id, "Errore di sessione!")
      return
    }

    // Continue to next scene or finale
    await continueStoryFromSession(
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      user,
      chapter,
      updatedSession,
      progress.current_theme,
    )
    return
  }

  // Handle regular choices
  if (!scene.choices || !Array.isArray(scene.choices)) {
    await bot.answerCallbackQuery(callbackQuery.id, "Errore: scena senza scelte!")
    return
  }

  const choice = scene.choices.find((c) => c.id === choiceId)
  if (!choice) {
    await bot.answerCallbackQuery(callbackQuery.id, "Errore: scelta non trovata!")
    return
  }

  const choiceValidation = PPValidator.validateChoice(scene.choices, choiceId, choice.pp_delta)
  if (!choiceValidation.isValid) {
    console.error(`[SECURITY] Choice validation failed: ${choiceValidation.reason} for user ${user.id}`)
    await bot.answerCallbackQuery(callbackQuery.id, "❌ Errore di sicurezza: scelta non valida!")
    return
  }

  // Verifica rate limits per PP
  const rateLimitValidation = await PPValidator.validateRateLimits(user.id, choice.pp_delta)
  if (!rateLimitValidation.isValid) {
    console.error(`[SECURITY] PP rate limit exceeded: ${rateLimitValidation.reason} for user ${user.id}`)
    await bot.answerCallbackQuery(callbackQuery.id, "❌ Limite PP raggiunto! Riprova più tardi.")
    return
  }

  // Registra audit trail per la scelta
  await PPValidator.auditPPGain({
    user_id: user.id,
    theme: progress.current_theme,
    chapter_number: progress.current_chapter,
    scene_index: Number.parseInt(sceneIndex),
    choice_id: choiceId,
    pp_gained: choice.pp_delta,
    session_total_pp: session.ppAccumulated + choice.pp_delta,
    user_agent: callbackQuery.message?.from?.language_code || "unknown",
    ip_address: "telegram", // Telegram non fornisce IP reali
  })

  // Log per audit trail
  console.log(`[AUDIT] User ${user.id} earned ${choice.pp_delta} PP from choice ${choice.id} in scene ${sceneIndex}`)

  // Update session with choice and PP
  const updatedSession = sessionManager.updateSession(user.id, {
    currentScene: session.currentScene + 1,
    ppAccumulated: session.ppAccumulated + choice.pp_delta,
  })

  if (!updatedSession) {
    await bot.answerCallbackQuery(callbackQuery.id, "Errore di sessione!")
    return
  }

  // Continue to next scene or finale
  await continueStoryFromSession(
    callbackQuery.message.chat.id,
    callbackQuery.message.message_id,
    user,
    chapter,
    updatedSession,
    progress.current_theme,
  )
}

async function handleContinueStory(callbackQuery: any, user: any) {
  const theme = callbackQuery.data.replace("continue_", "")

  const themeProgress = await storyManager.getThemeProgress(user.id, theme)
  console.log("[v0] Continue story - Theme progress:", themeProgress)

  let progress = await storyManager.getUserProgress(user.id)
  if (!progress) {
    progress = await storyManager.createUserProgress(user.id, theme)
  }

  await storyManager.updateUserProgress(
    user.id,
    progress.current_theme,
    themeProgress.current_chapter,
    themeProgress.completed,
  )

  await continueUserStoryWithTheme(
    callbackQuery.message.chat.id,
    user,
    theme,
    themeProgress,
    callbackQuery.message.message_id,
  )
}

async function handleShowThemes(callbackQuery: any, user: any) {
  const playerName = user.first_name || "Viaggiatore"

  const allProgress = await storyManager.getAllThemesProgress(user.id)

  const supabase = await createClient()
  const { data: activeEventData } = await supabase.rpc("get_active_event")
  const activeEvent = activeEventData && activeEventData.length > 0 ? activeEventData[0] : null

  const welcomeMessage = storyManager.formatStoryText(
    `🎭 <b>Scegli la Tua Avventura, {{PLAYER}}!</b>

{{KING}} ti aspetta in uno di questi regni magici:

${activeEvent ? `🎉 <b>EVENTO SPECIALE ATTIVO: ${activeEvent.name || activeEvent.title}</b> ${activeEvent.event_emoji || "🎃"}\n\n` : ""}${Object.keys(allProgress).length > 0 ? "📊 <i>I tuoi progressi sono mostrati accanto a ogni tema</i>\n\n" : ""}Scegli il tuo destino! ⚔️`,
    playerName,
  )

  const themes = [
    { key: "fantasy", name: "🏰 Fantasia", row: 0 },
    { key: "sci-fi", name: "🚀 Fantascienza", row: 0 },
    { key: "mystery", name: "🔍 Mistero", row: 1 },
    { key: "romance", name: "💕 Romantico", row: 1 },
    { key: "adventure", name: "🗺️ Avventura", row: 2 },
    { key: "horror", name: "👻 Horror", row: 2 },
    { key: "comedy", name: "😂 Commedia", row: 3 },
  ]

  const keyboard = { inline_keyboard: activeEvent ? [[]] : [[], [], [], []] }

  if (activeEvent) {
    keyboard.inline_keyboard[0].push({
      text: `${activeEvent.event_emoji || "🎉"} CONTEST - ${activeEvent.name || activeEvent.title}`,
      callback_data: `theme_${activeEvent.name}`,
    })
    keyboard.inline_keyboard.push([], [], [], [])
  }

  themes.forEach((theme) => {
    const progress = allProgress[theme.key]
    let buttonText = theme.name

    if (progress) {
      if (progress.completed) {
        buttonText += " ✅"
      } else if (progress.current_chapter > 1) {
        buttonText += ` (${progress.current_chapter})`
      }
    }

    const rowIndex = activeEvent ? theme.row + 1 : theme.row
    keyboard.inline_keyboard[rowIndex].push({
      text: buttonText,
      callback_data: `theme_${theme.key}`,
    })
  })

  keyboard.inline_keyboard.push([
    { text: "📈 Le Mie Statistiche", callback_data: "show_stats" },
    { text: "🔗 Condividi", switch_inline_query: "condividi progressi" },
  ])

  await bot.editMessageText(callbackQuery.message.chat.id, callbackQuery.message.message_id, welcomeMessage, keyboard)
}

async function continueUserStoryWithTheme(
  chatId: number,
  user: any,
  theme: string,
  themeProgress: any,
  messageId?: number,
) {
  const chapter = await storyManager.getChapter(theme, themeProgress.current_chapter)

  if (!chapter) {
    const errorMessage = "❌ Capitolo non trovato! Usa /reset per ricominciare."
    if (messageId) {
      await bot.editMessageText(chatId, messageId, errorMessage)
    } else {
      await bot.sendMessage(chatId, errorMessage)
    }
    return
  }

  // Create new session
  const session = sessionManager.createSession(user.id)

  // Start with first scene
  await continueStoryFromSession(chatId, messageId, user, chapter, session, theme)
}

async function handleStatsCommand(chatId: number, user: any) {
  const playerName = user.first_name || "Viaggiatore"
  const userStats = await storyManager.getUserStats(user.id)
  const botName = process.env.BOT_DISPLAY_NAME || "King of Carts"

  const statsMessage = storyManager.formatStoryText(
    `📊 <b>Statistiche di {{PLAYER}}</b>

🎯 <b>I Tuoi Progressi:</b>
• Capitoli completati: ${userStats.chaptersCompleted}
• Temi esplorati: ${userStats.themesCompleted}/7
• PP totali accumulati: ${userStats.totalPP} ⭐
• Tema attuale: ${userStats.currentTheme || "Nessuno"}
• Capitolo attuale: ${userStats.currentChapter}

<i>"La saggezza cresce con ogni storia vissuta!"</i> - {{KING}} ✨`,
    playerName,
  )

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🎭 Torna ai Temi", callback_data: "show_themes" },
        { text: "🔗 Condividi Progressi", switch_inline_query: `progressi ${userStats.chaptersCompleted} capitoli` },
      ],
    ],
  }

  await bot.sendMessage(chatId, statsMessage, keyboard)
}

async function continueUserStory(chatId: number, user: any, progress: any, messageId?: number) {
  const themeProgress = await storyManager.getThemeProgress(user.id, progress.current_theme)
  await continueUserStoryWithTheme(chatId, user, progress.current_theme, themeProgress, messageId)
}

async function continueStoryFromSession(
  chatId: number,
  messageId: number | undefined,
  user: any,
  chapter: any,
  session: any,
  theme?: string,
) {
  const playerName = user.first_name || "Viaggiatore"

  // Check if we should show finale
  if (session.currentScene >= chapter.scenes.length) {
    const currentTheme = theme || (await storyManager.getUserProgress(user.id))?.current_theme

    let finalPP = session.ppAccumulated
    const isEvent = await EventManager.isEventTheme(currentTheme)
    if (isEvent) {
      const multiplier = await EventManager.getPPMultiplier(currentTheme)
      finalPP = Math.round(session.ppAccumulated * multiplier)
      console.log(`[v0] Event multiplier applied: ${session.ppAccumulated} PP x ${multiplier} = ${finalPP} PP`)
    }

    const finaleText = storyManager.formatStoryText(chapter.finale.text, playerName, finalPP)

    console.log("[v0] Completing chapter for user:", user.id, "Theme:", currentTheme, "PP gained:", finalPP)
    await storyManager.completeChapter(user.id, currentTheme, finalPP)

    if (isEvent) {
      await EventManager.updateEventLeaderboard(user.id, currentTheme, finalPP)
      console.log(`[v0] Event leaderboard updated for user ${user.id} in theme ${currentTheme}`)
    }

    sessionManager.clearSession(user.id)

    const updatedThemeProgress = await storyManager.getThemeProgress(user.id, currentTheme)
    console.log("[v0] Updated theme progress after completion:", updatedThemeProgress)

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `➡️ Capitolo ${updatedThemeProgress.current_chapter} (${currentTheme})`,
            callback_data: `continue_${currentTheme}`,
          },
        ],
        [{ text: "🎭 Cambia Tema", callback_data: "show_themes" }],
        [{ text: "📊 Statistiche", callback_data: "show_stats" }],
      ],
    }

    if (messageId) {
      await bot.editMessageText(chatId, messageId, finaleText, keyboard)
    } else {
      await bot.sendMessage(chatId, finaleText, keyboard)
    }
    return
  }

  // Show current scene
  const scene = chapter.scenes[session.currentScene]
  const sceneText = storyManager.formatStoryText(scene.text, playerName)

  let keyboard
  if (scene.choices && Array.isArray(scene.choices) && scene.choices.length > 0) {
    // Scene has choices - create choice buttons
    keyboard = {
      inline_keyboard: scene.choices.map((choice) => [
        {
          text: choice.label,
          callback_data: `choice_${session.currentScene}_${choice.id}`,
        },
      ]),
    }
  } else {
    // Scene has no choices - create continue button
    keyboard = {
      inline_keyboard: [
        [
          {
            text: "➡️ Continua",
            callback_data: `choice_${session.currentScene}_continue`,
          },
        ],
      ],
    }
  }

  if (messageId) {
    await bot.editMessageText(chatId, messageId, sceneText, keyboard)
  } else {
    await bot.sendMessage(chatId, sceneText, keyboard)
  }
}

async function handleInlineQuery(inlineQuery: any) {
  console.log("[v0] Processing inline query:", inlineQuery.id, "Query:", inlineQuery.query)
  console.log("[v0] Inline query from user:", inlineQuery.from.id, inlineQuery.from.first_name)

  try {
    const query = inlineQuery.query?.toLowerCase() || ""
    const userId = inlineQuery.from.id.toString()

    console.log("[v0] Getting user stats for inline query...")
    const userStats = await storyManager.getUserStats(userId)
    console.log("[v0] User stats retrieved:", userStats)

    const playerName = inlineQuery.from.first_name || "Viaggiatore"
    const botName = process.env.BOT_DISPLAY_NAME || "King of Carts"
    const botUsername = process.env.BOT_USERNAME || "kingofcarts_betabot"

    console.log("[v0] Bot configuration - Display Name:", botName)
    console.log("[v0] Bot configuration - Username:", botUsername)
    console.log("[v0] Environment BOT_USERNAME:", process.env.BOT_USERNAME)

    const results = []

    console.log("[v0] Creating basic game invitation result...")
    const inviteUrl = `https://t.me/${botUsername}?start=invite_${userId}`
    console.log("[v0] Generated invite URL:", inviteUrl)

    results.push({
      type: "article",
      id: "invite_game",
      title: `🎭 ${botName} - Gioco Interattivo`,
      description: "Condividi il gioco di storytelling!",
      input_message_content: {
        message_text: `🎭 <b>${botName}</b>\n\n${playerName} ti invita a giocare!\n\nUn gioco di storytelling interattivo con 7 temi diversi. Inizia con /start!`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎭 Inizia Avventura",
              url: inviteUrl,
            },
          ],
        ],
      },
    })

    console.log("[v0] Created", results.length, "results for inline query")
    console.log("[v0] Sending answer to inline query...")

    const cacheTime = Number.parseInt(process.env.INLINE_CACHE_TIME || "10")

    await bot.answerInlineQuery(inlineQuery.id, results, {
      cache_time: cacheTime,
      is_personal: false,
    })

    console.log("[v0] Successfully answered inline query")
  } catch (error) {
    console.error("[v0] Error in handleInlineQuery:", error)
    try {
      await bot.answerInlineQuery(inlineQuery.id, [])
      console.log("[v0] Sent empty results due to error")
    } catch (answerError) {
      console.error("[v0] Failed to send empty results:", answerError)
    }
  }
}

async function handleContactSupport(callbackQuery: any, user: any) {
  const supportMessage = `
🎭 <b>Supporto King of Carts</b>

Ciao ${user.first_name}! Se hai problemi con il bot, prova questi passaggi:

1. 🔄 Usa /start per ricominciare
2. 📊 Controlla /stats per i tuoi progressi  
3. 🔧 Usa /reset se sei bloccato in una storia

Se il problema persiste, contatta gli sviluppatori con il codice errore: <code>${user.id.slice(0, 8)}</code>

<i>King of Carts ti ringrazia per la pazienza! ✨</i>
  `

  const keyboard = {
    inline_keyboard: [
      [{ text: "🏠 Menu Principale", callback_data: "show_themes" }],
      [{ text: "📊 Le Mie Statistiche", callback_data: "show_stats" }],
    ],
  }

  await bot.editMessageText(callbackQuery.message.chat.id, callbackQuery.message.message_id, supportMessage, keyboard)
}

async function handleHelpCommandInline(chatId: number) {
  const dailyLimit = process.env.RATE_LIMIT_DAILY_MAX || "20"

  const helpMessage = `
🎭 <b>Comandi King of Carts</b>

<b>Comandi Principali:</b>
/start - Inizia l'avventura e scegli un tema
/continue - Continua la tua storia attuale
/stats - Mostra le tue statistiche
/reset - Ricomincia il tema attuale dal capitolo 1
/leaderboard - Mostra la classifica globale
/help - Mostra questo messaggio

<b>Come Giocare:</b>
1. Scegli un tema (Fantasia, Fantascienza, Mistero, etc.)
2. Leggi le scene e fai le tue scelte
3. Accumula PP (Punti Psichedelici) con le tue decisioni
4. Continua all'infinito - le storie sono generate dall'AI!

<b>Limiti:</b>
• Massimo ${dailyLimit} richieste al giorno per utente
• I bottoni scadono dopo 5 minuti

<i>"Vedi oltre l'arcobaleno e diffondi amore e pace!" - King of Carts</i> ✨
  `

  const keyboard = {
    inline_keyboard: [
      [{ text: "🎭 Inizia Avventura", callback_data: "show_themes" }],
      [{ text: "📊 Le Mie Statistiche", callback_data: "show_stats" }],
    ],
  }

  await bot.sendMessage(chatId, helpMessage, keyboard)
}

async function handleContinueCommandInline(chatId: number, user: any) {
  const progress = await storyManager.getUserProgress(user.id)

  if (!progress || !progress.current_theme) {
    const message = `
🎭 <b>Nessuna Storia in Corso</b>

Ciao ${user.first_name}! Non hai ancora iniziato nessuna avventura.

Scegli un tema qui sotto per iniziare il tuo viaggio con King of Carts! ✨
    `

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏰 Fantasia", callback_data: "theme_fantasy" },
          { text: "🚀 Fantascienza", callback_data: "theme_sci-fi" },
        ],
        [
          { text: "🔍 Mistero", callback_data: "theme_mystery" },
          { text: "💕 Romantico", callback_data: "theme_romance" },
        ],
        [
          { text: "🗺️ Avventura", callback_data: "theme_adventure" },
          { text: "👻 Horror", callback_data: "theme_horror" },
        ],
        [{ text: "😂 Commedia", callback_data: "theme_comedy" }],
      ],
    }

    await bot.sendMessage(chatId, message, keyboard)
    return
  }

  await continueUserStory(chatId, user, progress)
}

async function handleResetCommandInline(chatId: number, user: any) {
  const progress = await storyManager.getUserProgress(user.id)

  if (!progress || !progress.current_theme) {
    await bot.sendMessage(chatId, "❌ Non hai nessuna storia da resettare. Usa /start per iniziare!")
    return
  }

  const isEvent = await EventManager.isEventTheme(progress.current_theme)
  if (isEvent) {
    const message = `
🎉 <b>Reset Non Disponibile per Eventi</b>

Il tema <b>${progress.current_theme}</b> è un evento contest speciale!

Per mantenere l'equità della competizione, non è possibile resettare i progressi durante gli eventi. Puoi continuare dal capitolo attuale o scegliere un altro tema.

<i>"La vera sfida è andare avanti, non ricominciare!" - King of Carts</i> ✨
    `

    const keyboard = {
      inline_keyboard: [
        [{ text: `▶️ Continua ${progress.current_theme}`, callback_data: `continue_${progress.current_theme}` }],
        [{ text: "🎭 Scegli Altro Tema", callback_data: "show_themes" }],
        [{ text: "📊 Statistiche", callback_data: "show_stats" }],
      ],
    }

    await bot.sendMessage(chatId, message, keyboard)
    return
  }

  await storyManager.updateUserProgress(user.id, progress.current_theme, 1, false)
  sessionManager.clearSession(user.id)

  const message = `
🔄 <b>Storia Resettata!</b>

Il tuo progresso nel tema <b>${progress.current_theme}</b> è stato resettato al Capitolo 1.

Sei pronto per ricominciare l'avventura? ✨
  `

  const keyboard = {
    inline_keyboard: [
      [{ text: `▶️ Ricomincia ${progress.current_theme}`, callback_data: `continue_${progress.current_theme}` }],
      [{ text: "🎭 Cambia Tema", callback_data: "show_themes" }],
    ],
  }

  await bot.sendMessage(chatId, message, keyboard)
}

async function handleLeaderboardCommandInline(chatId: number, user: any) {
  const appDomain = process.env.APP_DOMAIN || "https://v0-telegram-storytelling-bot.vercel.app"
  const botName = process.env.BOT_DISPLAY_NAME || "King of Carts"

  const message = `
🏆 <b>Classifica ${botName}</b>

La classifica completa è disponibile sulla pagina web:
🌐 ${appDomain}/leaderboard

Qui puoi vedere i migliori viaggiatori e i loro progressi attraverso i regni di ${botName}! ✨

<i>"La competizione sana alimenta la crescita!" - ${botName}</i>
  `

  const keyboard = {
    inline_keyboard: [
      [{ text: "🌐 Apri Classifica Web", url: `${appDomain}/leaderboard` }],
      [{ text: "📊 Le Mie Statistiche", callback_data: "show_stats" }],
      [{ text: "🎭 Torna ai Temi", callback_data: "show_themes" }],
    ],
  }

  await bot.sendMessage(chatId, message, keyboard)
}

async function handleRetryAction(callbackQuery: any, user: any) {
  const action = callbackQuery.data.replace("retry_", "")

  switch (action) {
    case "story":
      await handleContinueCommandInline(callbackQuery.message.chat.id, user)
      break
    case "progress":
      await handleStatsCommand(callbackQuery.message.chat.id, user)
      break
    case "action":
    default:
      await handleStartCommand(callbackQuery.message.chat.id, user)
      break
  }
}
