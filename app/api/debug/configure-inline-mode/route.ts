import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      console.error("[v0] TELEGRAM_BOT_TOKEN not configured")
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
    }

    console.log("[v0] Configuring bot menu commands and inline mode setup...")

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "🎭 Inizia l'avventura con King of Carts" },
          { command: "help", description: "📖 Mostra i comandi disponibili" },
          { command: "stats", description: "📊 Visualizza le tue statistiche" },
          { command: "continue", description: "▶️ Continua la storia corrente" },
          { command: "reset", description: "🔄 Ricomincia il tema attuale" },
          { command: "leaderboard", description: "🏆 Visualizza la classifica globale" },
        ],
      }),
    })

    const commandResult = await response.json()
    console.log("[v0] Bot menu commands configured:", commandResult)

    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const botInfo = await botInfoResponse.json()

    return NextResponse.json({
      success: true,
      message: "Bot menu commands configured successfully",
      botInfo: botInfo.result,
      commands: [
        "/start - 🎭 Inizia l'avventura con King of Carts",
        "/help - 📖 Mostra i comandi disponibili",
        "/stats - 📊 Visualizza le tue statistiche",
        "/continue - ▶️ Continua la storia corrente",
        "/reset - 🔄 Ricomincia il tema attuale",
        "/leaderboard - 🏆 Visualizza la classifica globale",
      ],
      inlineMode: {
        status: "Manual setup required",
        instructions: [
          "🔧 Per abilitare l'inline mode:",
          "1. Vai su @BotFather su Telegram",
          "2. Invia il comando /setinline",
          "3. Seleziona il tuo bot dalla lista",
          "4. Invia un testo placeholder come 'Cerca storie e condividi...'",
          "5. L'inline mode sarà abilitato!",
          "",
          "🎯 Come usare l'inline mode:",
          "• Scrivi @" + (botInfo.result?.username || "your_bot") + " in qualsiasi chat",
          "• Digita parole chiave come 'fantasia', 'progressi', 'sfida'",
          "• Seleziona il contenuto da condividere",
          "• I tuoi amici potranno vedere i tuoi progressi e unirsi al gioco!",
        ],
        features: [
          "🔗 Condivisione progressi personali",
          "🎭 Inviti per temi specifici",
          "⚔️ Sfide tra amici",
          "🏆 Link alla classifica web",
          "🎯 Contenuti personalizzati basati sui tuoi progressi",
        ],
      },
      commandResult,
    })
  } catch (error) {
    console.error("[v0] Error configuring bot commands:", error)
    return NextResponse.json({ error: "Failed to configure bot commands" }, { status: 500 })
  }
}
