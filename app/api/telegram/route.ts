import { type NextRequest, NextResponse } from "next/server"
import { TelegramBot } from "@/lib/telegram/bot"
import type { TelegramUpdate } from "@/lib/telegram/types"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"
import { AntiReplayManager } from "@/lib/security/anti-replay"
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
          text: "🎄 Apri Mini App",
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
          web_app: {
            url: `${process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app"}?view=leaderboard`,
          },
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
          url: `${process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app"}?event=${activeEvent.name}`,
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

    const playerName = inlineQuery.from.first_name || "Viaggiatore"
    const botName = process.env.BOT_DISPLAY_NAME || "King of Carts"
    const botUsername = process.env.BOT_USERNAME || "kingofcarts_betabot"

    const miniAppUrl = process.env.MINIAPP_URL || `https://t.me/${botUsername}/app`

    console.log("[v0] Bot configuration - Display Name:", botName)
    console.log("[v0] Bot configuration - Username:", botUsername)
    console.log("[v0] Mini App URL:", miniAppUrl)

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
          [{ text: "🎄 Apri Mini App", url: miniAppUrl }],
        ],
      },
    })

    console.log("[v0] Created 1 inline query result (invite only)")
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
