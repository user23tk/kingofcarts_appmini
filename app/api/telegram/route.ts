import { type NextRequest, NextResponse } from "next/server"
import type { TelegramUpdate } from "@/lib/telegram/types"

export const dynamic = "force-dynamic"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BOT_NAME = process.env.BOT_DISPLAY_NAME || "King of Carts"
const BOT_USERNAME = process.env.BOT_USERNAME || "kingofcarts_betabot"
const MINIAPP_URL = process.env.MINIAPP_URL || `https://t.me/${BOT_USERNAME}/app`

let bot: any = null
let antiReplayManager: any = null

async function getBot() {
  if (!bot) {
    const { TelegramBot } = await import("@/lib/telegram/bot")
    bot = new TelegramBot()
  }
  return bot
}

async function getAntiReplayManager() {
  if (!antiReplayManager) {
    const { AntiReplayManager } = await import("@/lib/security/anti-replay")
    antiReplayManager = AntiReplayManager
  }
  return antiReplayManager
}

async function forwardInlineQuery(request: NextRequest, body: TelegramUpdate): Promise<NextResponse> {
  const startTime = Date.now()
  const userId = body.inline_query?.from.id.toString()

  console.log(`[v0] Forwarding inline query from ${userId} to dedicated endpoint`)

  try {
    // Chiama l'endpoint inline dedicato internamente
    const inlineUrl = new URL("/api/telegram/inline", request.url)

    const response = await fetch(inlineUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET || "",
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()
    const totalTime = Date.now() - startTime

    console.log(`[v0] Inline forward completed in ${totalTime}ms - ok: ${result.ok}`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error(`[v0] Inline forward failed after ${totalTime}ms:`, error)
    // Ritorna ok per non bloccare Telegram
    return NextResponse.json({ ok: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const secretToken = request.headers.get("x-telegram-bot-api-secret-token")
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET

    if (!expectedToken || secretToken !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const update: TelegramUpdate = await request.json()

    if (!update.update_id || typeof update.update_id !== "number") {
      return NextResponse.json({ error: "Invalid update format" }, { status: 400 })
    }

    if (update.inline_query) {
      return forwardInlineQuery(request, update)
    }

    // Regular path - load heavy modules only when needed
    console.log("[v0] Received Telegram update:", update.update_id)

    if (update.message) {
      await handleMessageWithRecovery(update.message)
    } else if (update.callback_query) {
      await handleCallbackQueryWithRecovery(update.callback_query)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[v0] Telegram webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function handleMessageWithRecovery(message: any) {
  const botInstance = await getBot()
  try {
    await handleMessage(message, botInstance)
  } catch (error) {
    console.error("[v0] Message handling error:", error)
    const chatId = message.chat?.id
    if (chatId) {
      try {
        await botInstance.sendMessage(chatId, "❌ Si è verificato un errore. Riprova con /start")
      } catch (sendError) {
        console.error("[v0] Failed to send error message:", sendError)
      }
    }
  }
}

async function handleCallbackQueryWithRecovery(callbackQuery: any) {
  const botInstance = await getBot()
  const AntiReplay = await getAntiReplayManager()
  try {
    await handleCallbackQuery(callbackQuery, botInstance, AntiReplay)
  } catch (error) {
    console.error("[v0] Callback handling error:", error)
    try {
      await botInstance.answerCallbackQuery(callbackQuery.id, "❌ Errore. Riprova con /start")
    } catch (answerError) {
      console.error("[v0] Failed to answer callback query:", answerError)
    }
  }
}

async function handleMessage(message: any, botInstance: any) {
  if (!message.from || message.from.is_bot) {
    return
  }

  console.log("[v0] Processing message from user:", message.from.id)

  const user = await botInstance.getOrCreateUser(message.from)
  if (!user) {
    console.error("[v0] Failed to get/create user")
    return
  }

  const text = message.text?.toLowerCase() || ""

  if (text.startsWith("/start")) {
    const { handleStartCommand } = await import("@/lib/commands/start-command")
    await handleStartCommand(message.chat.id, user)
  } else if (text.startsWith("/help")) {
    await handleHelpCommand(message.chat.id, botInstance)
  } else if (text.startsWith("/stats")) {
    await handleStatsCommandRedirect(message.chat.id, botInstance)
  } else if (text.startsWith("/continue")) {
    await handleContinueCommandRedirect(message.chat.id, botInstance)
  } else if (text.startsWith("/reset")) {
    await handleResetCommandRedirect(message.chat.id, botInstance)
  } else if (text.startsWith("/leaderboard")) {
    await handleLeaderboardCommandRedirect(message.chat.id, botInstance)
  } else if (text.startsWith("/event")) {
    await handleEventCommandRedirect(message.chat.id, botInstance)
  } else {
    await botInstance.sendMessage(
      message.chat.id,
      "🤔 Usa /start per aprire la Mini App e giocare!\n\nComandi disponibili:\n/start - Apri il gioco\n/help - Aiuto",
    )
  }
}

async function handleHelpCommand(chatId: number, botInstance: any) {
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
Scrivi @${BOT_USERNAME} in qualsiasi chat per condividere il gioco con i tuoi amici!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🎄 Apri Mini App",
          web_app: { url: MINIAPP_URL },
        },
      ],
    ],
  }

  await botInstance.sendMessage(chatId, helpMessage, keyboard)
}

async function handleStatsCommandRedirect(chatId: number, botInstance: any) {
  const message = `📊 <b>Le tue statistiche</b>

Per visualizzare le tue statistiche dettagliate, apri la Mini App!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "📊 Vedi Statistiche",
          web_app: { url: `${MINIAPP_URL}?view=stats` },
        },
      ],
    ],
  }

  await botInstance.sendMessage(chatId, message, keyboard)
}

async function handleContinueCommandRedirect(chatId: number, botInstance: any) {
  const message = `▶️ <b>Continua la tua avventura</b>

Apri la Mini App per continuare dal punto in cui ti sei fermato!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "▶️ Continua Avventura",
          web_app: { url: MINIAPP_URL },
        },
      ],
    ],
  }

  await botInstance.sendMessage(chatId, message, keyboard)
}

async function handleResetCommandRedirect(chatId: number, botInstance: any) {
  const message = `🔄 <b>Ricomincia tema</b>

Apri la Mini App per ricominciare un tema dall'inizio!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🔄 Gestisci Temi",
          web_app: { url: MINIAPP_URL },
        },
      ],
    ],
  }

  await botInstance.sendMessage(chatId, message, keyboard)
}

async function handleLeaderboardCommandRedirect(chatId: number, botInstance: any) {
  const message = `🏆 <b>Classifica Globale</b>

Apri la Mini App per vedere la classifica completa e il tuo posizionamento!`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🏆 Vedi Classifica",
          web_app: {
            url: `${MINIAPP_URL}?view=leaderboard`,
          },
        },
      ],
    ],
  }

  await botInstance.sendMessage(chatId, message, keyboard)
}

async function handleEventCommandRedirect(chatId: number, botInstance: any) {
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  const { data: activeEventData } = await supabase.rpc("get_active_event")
  const activeEvent = activeEventData && activeEventData.length > 0 ? activeEventData[0] : null

  if (!activeEvent) {
    await botInstance.sendMessage(chatId, "❌ Nessun evento attivo al momento. Controlla più tardi!")
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
          url: `${MINIAPP_URL}?event=${activeEvent.name}`,
        },
      ],
    ],
  }

  await botInstance.sendMessage(chatId, message, keyboard)
}

async function handleCallbackQuery(callbackQuery: any, botInstance: any, AntiReplay: any) {
  console.log("[v0] Processing callback query:", callbackQuery.data)

  if (AntiReplay.isCallbackProcessed(callbackQuery.id)) {
    await botInstance.answerCallbackQuery(callbackQuery.id, "Azione già processata!")
    return
  }

  AntiReplay.markCallbackProcessed(callbackQuery.id)

  const user = await botInstance.getOrCreateUser(callbackQuery.from)
  if (!user) {
    await botInstance.answerCallbackQuery(callbackQuery.id, "Error: User not found")
    return
  }

  await botInstance.answerCallbackQuery(callbackQuery.id, "Apri la Mini App per giocare!")
}
