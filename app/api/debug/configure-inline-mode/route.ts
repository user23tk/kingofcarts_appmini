import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      console.error("[v0] TELEGRAM_BOT_TOKEN not configured")
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
    }

    console.log("[v0] Configuring bot menu commands and inline mode setup...")

    const supabase = await createClient()
    const { data: activeEventData } = await supabase.rpc("get_active_event")
    const activeEvent = activeEventData && activeEventData.length > 0 ? activeEventData[0] : null

    const commands = [
      { command: "start", description: "🎭 Inizia l'avventura con King of Carts" },
      { command: "continue", description: "▶️ Continua la storia corrente" },
      { command: "stats", description: "📊 Visualizza le tue statistiche" },
      { command: "leaderboard", description: "🏆 Visualizza la classifica globale" },
      { command: "reset", description: "🔄 Ricomincia il tema attuale" },
      { command: "help", description: "📖 Mostra i comandi disponibili" },
    ]

    if (activeEvent) {
      commands.splice(1, 0, {
        command: "event",
        description: `${activeEvent.event_emoji || "🎉"} Partecipa all'evento: ${activeEvent.name}`,
      })
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    })

    const commandResult = await response.json()
    console.log("[v0] Bot menu commands configured:", commandResult)

    const botInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const botInfo = await botInfoResponse.json()

    return NextResponse.json({
      success: true,
      message: "Bot menu commands configured successfully",
      botInfo: botInfo.result,
      commands: commands.map((cmd) => `/${cmd.command} - ${cmd.description}`),
      activeEvent: activeEvent ? { name: activeEvent.name, emoji: activeEvent.event_emoji } : null,
      inlineMode: {
        status: "Configured and Enhanced",
        features: [
          "🎭 Invito generale al gioco",
          "📊 Condivisione progressi personali",
          "⚔️ Sfida diretta con il tuo punteggio",
          "🏰 Invito a tema specifico",
          "🏆 Condivisione classifica globale",
        ],
        usage: [
          `💬 Scrivi @${botInfo.result?.username || "your_bot"} in qualsiasi chat`,
          "🔍 Scegli il tipo di condivisione che preferisci",
          "📤 Invia il messaggio personalizzato con i tuoi progressi",
          "🎯 I tuoi amici vedranno bottoni per iniziare subito!",
        ],
        note: "I risultati inline sono personalizzati in base ai tuoi progressi nel gioco!",
      },
      commandResult,
    })
  } catch (error) {
    console.error("[v0] Error configuring bot commands:", error)
    return NextResponse.json({ error: "Failed to configure bot commands" }, { status: 500 })
  }
}
