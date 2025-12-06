import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
// Massimizza velocità rimuovendo timeout
export const maxDuration = 5

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BOT_NAME = process.env.BOT_DISPLAY_NAME || "King of Carts"
const BOT_USERNAME = process.env.BOT_USERNAME || "kingofcarts_betabot"
const MINIAPP_URL = process.env.MINIAPP_URL || `https://t.me/${BOT_USERNAME}/app`

// Interfaccia per inline query
interface InlineQuery {
  id: string
  from: {
    id: number
    first_name?: string
    username?: string
  }
  query: string
  offset: string
}

// Funzione diretta per rispondere all'inline query - senza dipendenze esterne
async function answerInlineQuery(
  inlineQueryId: string,
  results: any[],
  cacheTime = 0,
  isPersonal = true,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerInlineQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inline_query_id: inlineQueryId,
        results,
        cache_time: cacheTime,
        is_personal: isPersonal,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error("[v0] Telegram API error:", data.description)
      return { ok: false, error: data.description }
    }

    return { ok: true }
  } catch (error) {
    console.error("[v0] answerInlineQuery fetch error:", error)
    return { ok: false, error: String(error) }
  }
}

// Costruisce i risultati inline - puro, senza IO
function buildInlineResults(userId: string, playerName: string): any[] {
  const inviteUrl = `https://t.me/${BOT_USERNAME}?start=invite_${userId}`

  return [
    {
      type: "article",
      id: "play_now",
      title: `🎮 Gioca a ${BOT_NAME}`,
      description: "Avventure interattive con storie infinite!",
      thumb_url: "https://v0-beta-3-mini-app.vercel.app/og-image.png",
      input_message_content: {
        message_text: `🎮 <b>${BOT_NAME}</b>\n\n${playerName} ti sfida!\n\n🎭 Storie interattive generate dall'AI\n🏆 Classifica globale\n🎄 Evento Natale attivo!\n\n✨ Gioca ora!`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [[{ text: "🎮 Gioca Ora", url: MINIAPP_URL }]],
      },
    },
    {
      type: "article",
      id: "invite_friends",
      title: `👥 Invita Amici`,
      description: "Condividi il gioco con i tuoi amici!",
      thumb_url: "https://v0-beta-3-mini-app.vercel.app/og-image.png",
      input_message_content: {
        message_text: `👥 <b>Unisciti a ${BOT_NAME}!</b>\n\n${playerName} ti invita a giocare!\n\n🌈 7 temi diversi da esplorare\n📖 Storie infinite\n🏆 Sfida i tuoi amici in classifica\n\n🎁 Inizia subito!`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [[{ text: "🎭 Inizia Avventura", url: inviteUrl }]],
      },
    },
    {
      type: "article",
      id: "natale_event",
      title: `🎄 Evento Natale 2025`,
      description: "Contest speciale con 2x PP!",
      thumb_url: "https://v0-beta-3-mini-app.vercel.app/og-image.png",
      input_message_content: {
        message_text: `🎄 <b>Evento Natale 2025</b>\n\n${playerName} partecipa al contest natalizio!\n\n🎁 Punti raddoppiati (2x PP)\n🏆 Classifica dedicata\n⏰ Fino al 6 Gennaio 2026\n\n✨ Unisciti ora!`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [[{ text: "🎄 Gioca Evento Natale", url: `${MINIAPP_URL}?startapp=natale` }]],
      },
    },
  ]
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verifica secret token
    const secretToken = request.headers.get("x-telegram-bot-api-secret-token")
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET

    if (!expectedToken || secretToken !== expectedToken) {
      console.error("[v0] Inline: Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const inlineQuery: InlineQuery | undefined = body.inline_query

    if (!inlineQuery) {
      // Non è una inline query, ritorna errore
      console.log("[v0] Inline: No inline_query in body")
      return NextResponse.json({ error: "Not an inline query" }, { status: 400 })
    }

    const userId = inlineQuery.from.id.toString()
    const playerName = inlineQuery.from.first_name || "Viaggiatore"
    const query = inlineQuery.query

    console.log(`[v0] Inline query received - user: ${userId}, query: "${query}"`)

    // Costruisci risultati
    const results = buildInlineResults(userId, playerName)
    const buildTime = Date.now() - startTime

    // Rispondi con await per garantire l'esecuzione
    const response = await answerInlineQuery(
      inlineQuery.id,
      results,
      0, // cache_time = 0 per massima reattività
      true, // is_personal = true per risultati personalizzati
    )

    const totalTime = Date.now() - startTime

    if (response.ok) {
      console.log(`[v0] Inline query answered successfully in ${totalTime}ms (build: ${buildTime}ms)`)
      return NextResponse.json({ ok: true, time_ms: totalTime })
    } else {
      console.error(`[v0] Inline query failed after ${totalTime}ms:`, response.error)
      return NextResponse.json({ ok: false, error: response.error }, { status: 500 })
    }
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error(`[v0] Inline endpoint error after ${totalTime}ms:`, error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Endpoint GET per test manuale
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const key = url.searchParams.get("key")
  const adminKey = process.env.DEBUG_ADMIN_KEY

  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    status: "Inline endpoint ready",
    config: {
      bot_username: BOT_USERNAME,
      bot_name: BOT_NAME,
      miniapp_url: MINIAPP_URL,
      cache_time: 0,
      is_personal: true,
    },
    sample_results: buildInlineResults("123456789", "TestUser"),
  })
}
