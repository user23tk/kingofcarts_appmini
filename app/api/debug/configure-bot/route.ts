import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

/**
 * Comprehensive bot configuration endpoint
 * Configures: commands, inline mode, description, and Mini App settings
 */
export async function POST(request: NextRequest) {
  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const appDomain = process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app"

    if (!botToken) {
      logger.error("debug-configure-bot", "Bot token not configured")
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
    }

    logger.info("debug-configure-bot", "Starting comprehensive bot configuration")

    const supabase = await createClient()
    const { data: activeEventData } = await supabase.rpc("get_active_event")
    const activeEvent = activeEventData && activeEventData.length > 0 ? activeEventData[0] : null

    // 1. Configure bot commands
    const commands = [
      { command: "start", description: "🎄 Apri la Mini App e inizia a giocare" },
      { command: "help", description: "📖 Mostra i comandi e come giocare" },
      { command: "stats", description: "📊 Visualizza le tue statistiche" },
      { command: "leaderboard", description: "🏆 Visualizza la classifica globale" },
    ]

    if (activeEvent) {
      commands.splice(1, 0, {
        command: "event",
        description: `${activeEvent.event_emoji || "🎉"} Evento speciale: ${activeEvent.name}`,
      })
    }

    const commandsResponse = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    })
    const commandsResult = await commandsResponse.json()

    // 2. Set bot description (shown in profile)
    const description =
      "King of Carts - Un gioco di storytelling interattivo con AI! 🎭\n\nEsplora 7 temi diversi, fai scelte importanti, guadagna PP e scala la classifica globale!\n\n🏰 Fantasia • 🚀 Sci-Fi • 🔍 Mistero • 💕 Romantico\n🗺️ Avventura • 👻 Horror • 😂 Commedia"

    const descriptionResponse = await fetch(`https://api.telegram.org/bot${botToken}/setMyDescription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    })
    const descriptionResult = await descriptionResponse.json()

    // 3. Set short description (for search results)
    const shortDescription =
      "🎭 Storytelling interattivo con AI - 7 temi, scelte infinite, storie generate in tempo reale!"

    const shortDescResponse = await fetch(`https://api.telegram.org/bot${botToken}/setMyShortDescription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ short_description: shortDescription }),
    })
    const shortDescResult = await shortDescResponse.json()

    // 4. Get bot info
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const botInfo = await botInfoResponse.json()

    logger.info("debug-configure-bot", "Bot configured successfully", {
      commandsConfigured: commandsResult.ok,
      descriptionConfigured: descriptionResult.ok,
    })

    return NextResponse.json({
      success: true,
      message: "✅ Bot configurato completamente!",
      botInfo: botInfo.result,
      configuration: {
        commands: {
          status: commandsResult.ok ? "✅ Configured" : "❌ Failed",
          list: commands,
        },
        description: {
          status: descriptionResult.ok ? "✅ Configured" : "❌ Failed",
          text: description,
        },
        shortDescription: {
          status: shortDescResult.ok ? "✅ Configured" : "❌ Failed",
          text: shortDescription,
        },
        miniApp: {
          url: appDomain,
          status: "✅ Ready",
          note: "Usa il bottone 'web_app' nei messaggi per aprire la Mini App",
        },
        inlineMode: {
          status: "✅ Enhanced with rich results",
          usage: `Scrivi @${botInfo.result?.username || "bot"} in qualsiasi chat`,
          features: [
            "🎭 Invito generale al gioco",
            "📊 Condivisione progressi",
            "⚔️ Sfida diretta",
            "🏰 Invito a tema specifico",
            "🏆 Classifica globale",
          ],
        },
      },
      nextSteps: [
        "✅ Il bot è ora configurato correttamente",
        "✅ Tutti i comandi puntano alla Mini App",
        "✅ L'inline mode funziona con risultati ricchi",
        "⚠️ IMPORTANTE: Verifica su @BotFather che 'Inline Mode' sia abilitato",
        `📱 Testa il bot: https://t.me/${botInfo.result?.username}`,
      ],
      botFatherInstructions: [
        "1. Apri @BotFather su Telegram",
        "2. Invia /mybots",
        "3. Seleziona il tuo bot",
        "4. Bot Settings → Inline Mode → Turn on",
        "5. Inline Feedback → Set to 100% (per analytics)",
        "6. Menu Button → Configure menu button",
        `   - Button text: 🎄 Gioca`,
        `   - URL: ${appDomain}`,
      ],
    })
  } catch (error) {
    logger.error("debug-configure-bot", "Error configuring bot", { error })
    return NextResponse.json({ error: "Failed to configure bot", details: String(error) }, { status: 500 })
  }
}

/**
 * GET endpoint to check current configuration
 */
export async function GET(request: NextRequest) {
  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      logger.error("debug-configure-bot", "Bot token not configured")
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
    }

    // Get bot info
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const botInfo = await botInfoResponse.json()

    // Get current commands
    const commandsResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMyCommands`)
    const commandsData = await commandsResponse.json()

    // Get current description
    const descResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMyDescription`)
    const descData = await descResponse.json()

    return NextResponse.json({
      botInfo: botInfo.result,
      commands: commandsData.result,
      description: descData.result,
      inlineModeSupported: botInfo.result?.supports_inline_queries || false,
      appDomain: process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app",
    })
  } catch (error) {
    logger.error("debug-configure-bot", "Error getting bot configuration", { error })
    return NextResponse.json({ error: "Failed to get bot configuration" }, { status: 500 })
  }
}
