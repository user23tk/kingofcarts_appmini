import { type NextRequest, NextResponse } from "next/server"
import { TelegramBot } from "@/lib/telegram/bot"
import type { TelegramUpdate } from "@/lib/telegram/types"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"
import { AntiReplayManager } from "@/lib/security/anti-replay"
import { AdvancedRateLimiter } from "@/lib/security/rate-limiter"
import { handleStartCommand } from "@/lib/commands/start-command"
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

    if (!expectedToken || secretToken !== expectedToken) {
      console.log("[v0] Unauthorized webhook request from:", request.ip)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
    return
  }

  console.log("[v0] Processing message from user:", message.from.id)

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
        [
          {
            text: "🎮 Apri Mini App",
            web_app: { url: process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app" },
          },
        ],
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
  await sessionManager.incrementInteractionCount()

  const text = message.text?.toLowerCase() || ""

  if (text.startsWith("/start")) {
    await handleStartCommand(message.chat.id, user)
  } else if (text.startsWith("/help")) {
    await handleHelpCommand(message.chat.id)
  } else if (text.startsWith("/stats")) {
    await handleStatsCommandRedirect(message.chat.id, user)
  } else if (text.startsWith("/continue")) {
    await handleContinueCommandRedirect(message.chat.id, user)
  } else if (text.startsWith("/reset")) {
    await handleResetCommandRedirect(message.chat.id, user)
  } else if (text.startsWith("/leaderboard")) {
    await handleLeaderboardCommandRedirect(message.chat.id, user)
  } else if (text.startsWith("/event")) {
    await handleEventCommandRedirect(message.chat.id, user)
  } else {
    await bot.sendMessage(
      message.chat.id,
      "🤔 Usa /start per aprire la Mini App e giocare!\n\nComandi disponibili:\n/start - Apri il gioco\n/help - Aiuto",
    )
  }
}

async function handleHelpCommand(chatId: number) {
  const helpMessage = `📖 <b>Aiuto King of Carts</b>

<b>Comandi disponibili:</b>
/start - Apri la Mini App e inizia a giocare
/help - Mostra questo messaggio di aiuto

<b>Come giocare:</b>
1. Usa /start per aprire la Mini App
2. Scegli un tema (Fantasia, Sci-Fi, etc.)
3. Leggi le scene e fai le tue scelte
4. Guadagna PP (Punti Psichedelici) completando i capitoli
5. Scala la classifica globale!

<b>Modalità Inline:</b>
Scrivi @${process.env.BOT_USERNAME || "kingofcarts_betabot"} in qualsiasi chat per condividere il gioco con i tuoi amici!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🎮 Apri Mini App",
          web_app: { url: process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app" },
        },
      ],
    ],
  }

  await bot.sendMessage(chatId, helpMessage, keyboard)
}

async function handleStatsCommandRedirect(chatId: number, user: any) {
  const message = `📊 <b>Le tue statistiche</b>

Per visualizzare le tue statistiche dettagliate, apri la Mini App!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "📊 Vedi Statistiche",
          web_app: { url: `${process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app"}?view=stats` },
        },
      ],
    ],
  }

  await bot.sendMessage(chatId, message, keyboard)
}

async function handleContinueCommandRedirect(chatId: number, user: any) {
  const message = `▶️ <b>Continua la tua avventura</b>

Apri la Mini App per continuare dal punto in cui ti sei fermato!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "▶️ Continua Avventura",
          web_app: { url: process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app" },
        },
      ],
    ],
  }

  await bot.sendMessage(chatId, message, keyboard)
}

async function handleResetCommandRedirect(chatId: number, user: any) {
  const message = `🔄 <b>Ricomincia tema</b>

Apri la Mini App per ricominciare un tema dall'inizio!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🔄 Gestisci Temi",
          web_app: { url: process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app" },
        },
      ],
    ],
  }

  await bot.sendMessage(chatId, message, keyboard)
}

async function handleLeaderboardCommandRedirect(chatId: number, user: any) {
  const message = `🏆 <b>Classifica Globale</b>

Apri la Mini App per vedere la classifica completa e il tuo posizionamento!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🏆 Vedi Classifica",
          web_app: { url: `${process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app"}?view=leaderboard` },
        },
      ],
    ],
  }

  await bot.sendMessage(chatId, message, keyboard)
}

async function handleEventCommandRedirect(chatId: number, user: any) {
  const supabase = await createClient()
  const { data: activeEventData } = await supabase.rpc("get_active_event")
  const activeEvent = activeEventData && activeEventData.length > 0 ? activeEventData[0] : null

  if (!activeEvent) {
    await bot.sendMessage(chatId, "❌ Nessun evento attivo al momento. Controlla più tardi!")
    return
  }

  const message = `${activeEvent.event_emoji || "🎉"} <b>EVENTO: ${activeEvent.name || activeEvent.title}</b>

${activeEvent.description || "Partecipa all'evento speciale!"}

Apri la Mini App per partecipare all'evento!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: `${activeEvent.event_emoji || "🎉"} Partecipa all'Evento`,
          web_app: {
            url: `${process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app"}?event=${activeEvent.name}`,
          },
        },
      ],
    ],
  }

  await bot.sendMessage(chatId, message, keyboard)
}

async function handleCallbackQuery(callbackQuery: any) {
  console.log("[v0] Processing callback query:", callbackQuery.data)

  if (AntiReplayManager.isCallbackProcessed(callbackQuery.id)) {
    await bot.answerCallbackQuery(callbackQuery.id, "Azione già processata!")
    return
  }

  AntiReplayManager.markCallbackProcessed(callbackQuery.id)

  const user = await bot.getOrCreateUser(callbackQuery.from)
  if (!user) {
    await bot.answerCallbackQuery(callbackQuery.id, "Error: User not found")
    return
  }

  await bot.answerCallbackQuery(callbackQuery.id, "Apri la Mini App per giocare!")
}

async function handleInlineQuery(inlineQuery: any) {
  console.log("[v0] Processing inline query:", inlineQuery.id, "Query:", inlineQuery.query)
  console.log("[v0] Inline query from user:", inlineQuery.from.id, inlineQuery.from.first_name)

  try {
    const query = inlineQuery.query?.toLowerCase() || ""
    const userId = inlineQuery.from.id.toString()

    console.log("[v0] Getting user stats for inline query...")
    const userStats = await storyManager.getUserStats(userId)
    const supabase = await createClient()

    const { data: userProgress } = await supabase
      .from("user_theme_progress")
      .select("theme_name, current_chapter")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    console.log("[v0] User stats retrieved:", userStats)
    console.log("[v0] User current progress:", userProgress)

    const playerName = inlineQuery.from.first_name || "Viaggiatore"
    const botName = process.env.BOT_DISPLAY_NAME || "King of Carts"
    const botUsername = process.env.BOT_USERNAME || "kingofcarts_betabot"

    console.log("[v0] Bot configuration - Display Name:", botName)
    console.log("[v0] Bot configuration - Username:", botUsername)
    console.log("[v0] Environment BOT_USERNAME:", process.env.BOT_USERNAME)

    const results = []
    const inviteUrl = `https://t.me/${botUsername}?start=invite_${userId}`

    results.push({
      type: "article",
      id: "invite_general",
      title: `🎭 Invita Amici a ${botName}`,
      description: "Condividi il gioco di storytelling interattivo!",
      thumbnail_url: "https://v0-beta-3-mini-app.vercel.app/og-image.png",
      input_message_content: {
        message_text: `🎭 <b>${botName}</b>\n\n${playerName} ti invita a giocare!\n\n🌈 Un gioco di storytelling interattivo con 7 temi diversi\n📖 Storie infinite generate dall'AI\n🏆 Classifica globale e sfide\n\n✨ Inizia la tua avventura ora!`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎭 Inizia Avventura", url: inviteUrl }],
          [{ text: "🏆 Vedi Classifica", url: `https://v0-beta-3-mini-app.vercel.app` }],
        ],
      },
    })

    if (userStats && userStats.total_chapters_completed > 0) {
      const progressText = `🎭 <b>I Miei Progressi in ${botName}</b>\n\n👤 ${playerName}\n\n📊 <b>Statistiche:</b>\n🏆 PP Totali: ${userStats.total_pp}\n📖 Capitoli Completati: ${userStats.total_chapters_completed}\n🎯 Temi Esplorati: ${userStats.themes_unlocked}\n⭐ Rank: ${userStats.rank_name}\n\n${playerName} sta dominando il gioco! Unisciti alla sfida!`

      results.push({
        type: "article",
        id: "share_stats",
        title: `📊 Condividi i Tuoi Progressi`,
        description: `${userStats.total_pp} PP • ${userStats.total_chapters_completed} Capitoli • Rank: ${userStats.rank_name}`,
        thumbnail_url: "https://v0-beta-3-mini-app.vercel.app/og-image.png",
        input_message_content: {
          message_text: progressText,
          parse_mode: "HTML",
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎮 Gioca Anche Tu", url: inviteUrl }],
            [{ text: "🏆 Vedi Classifica Completa", url: `https://v0-beta-3-mini-app.vercel.app` }],
          ],
        },
      })
    }

    if (userStats && userStats.total_pp > 0) {
      const challengeText = `⚔️ <b>Sfida in ${botName}!</b>\n\n${playerName} ti sfida!\n\n💎 Il mio punteggio: <b>${userStats.total_pp} PP</b>\n🏆 Rank: ${userStats.rank_name}\n📖 Capitoli: ${userStats.total_chapters_completed}\n\n🔥 Riesci a battermi? Accetta la sfida!`

      results.push({
        type: "article",
        id: "challenge_friends",
        title: `⚔️ Sfida i Tuoi Amici`,
        description: `Il tuo punteggio: ${userStats.total_pp} PP • Sfida gli altri a batterti!`,
        thumbnail_url: "https://v0-beta-3-mini-app.vercel.app/og-image.png",
        input_message_content: {
          message_text: challengeText,
          parse_mode: "HTML",
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: "⚔️ Accetta la Sfida", url: inviteUrl }],
            [{ text: "🏆 Vedi Classifica", url: `https://v0-beta-3-mini-app.vercel.app` }],
          ],
        },
      })
    }

    if (userProgress && userProgress.theme_name) {
      const themeEmojis: Record<string, string> = {
        fantasy: "🏰",
        "sci-fi": "🚀",
        mystery: "🔍",
        romance: "💕",
        adventure: "🗺️",
        horror: "👻",
        comedy: "😂",
      }

      const themeEmoji = themeEmojis[userProgress.theme_name] || "🎭"
      const themeText = `${themeEmoji} <b>${botName} - ${userProgress.theme_name.charAt(0).toUpperCase() + userProgress.theme_name.slice(1)}</b>\n\n${playerName} sta giocando al tema <b>${userProgress.theme_name}</b>!\n\n📖 Capitolo Attuale: ${userProgress.current_chapter}\n💎 PP Totali: ${userStats?.total_pp || 0}\n\n🎯 Unisciti all'avventura!`

      results.push({
        type: "article",
        id: `invite_theme_${userProgress.theme_name}`,
        title: `${themeEmoji} Invita al Tema: ${userProgress.theme_name}`,
        description: `Condividi la tua avventura in ${userProgress.theme_name}`,
        thumbnail_url: "https://v0-beta-3-mini-app.vercel.app/og-image.png",
        input_message_content: {
          message_text: themeText,
          parse_mode: "HTML",
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: `${themeEmoji} Gioca ${userProgress.theme_name}`, url: inviteUrl }],
            [{ text: "🎭 Esplora Altri Temi", url: inviteUrl }],
          ],
        },
      })
    }

    results.push({
      type: "article",
      id: "share_leaderboard",
      title: `🏆 Condividi la Classifica`,
      description: "Mostra la classifica globale di King of Carts",
      thumbnail_url: "https://v0-beta-3-mini-app.vercel.app/og-image.png",
      input_message_content: {
        message_text: `🏆 <b>Classifica Globale - ${botName}</b>\n\n🌟 Scopri chi domina i regni delle storie!\n\n📊 Visualizza le statistiche complete\n🎭 Confronta i tuoi progressi\n⚔️ Sfida i migliori giocatori\n\n👑 Chi sarà il prossimo King of Carts?`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏆 Vedi Classifica Completa", url: `https://v0-beta-3-mini-app.vercel.app` }],
          [{ text: "🎮 Inizia a Giocare", url: inviteUrl }],
        ],
      },
    })

    console.log("[v0] Created", results.length, "inline query results")
    console.log("[v0] Sending answer to inline query...")

    const cacheTime = Number.parseInt(process.env.INLINE_CACHE_TIME || "10")

    await bot.answerInlineQuery(inlineQuery.id, results, {
      cache_time: cacheTime,
      is_personal: true,
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
