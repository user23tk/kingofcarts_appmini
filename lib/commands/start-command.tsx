import { TelegramBot } from "@/lib/telegram/bot"
import { StoryManager } from "@/lib/story/story-manager"
import { createClient } from "@/lib/supabase/server"

const bot = new TelegramBot()
const storyManager = new StoryManager()

export async function handleStartCommand(chatId: number, user: any) {
  const playerName = user.first_name || "Viaggiatore"

  const supabase = await createClient()
  const { data: activeEventData } = await supabase.rpc("get_active_event")
  const activeEvent = activeEventData && activeEventData.length > 0 ? activeEventData[0] : null

  const welcomeMessage = storyManager.formatStoryText(
    `
🎭 <b>Benvenuto nel Regno di {{KING}}!</b>

Salve, {{PLAYER}}! Io sono {{KING}}, il tuo mentore psichedelico attraverso i regni delle storie infinite! 🌈✨

Sono qui per guidarti a "vedere oltre l'arcobaleno" e diffondere amore e pace attraverso 7 temi mistici:

🏰 <b>Fantasia</b> • 🚀 <b>Fantascienza</b> • 🔍 <b>Mistero</b> • 💕 <b>Romantico</b>
🗺️ <b>Avventura</b> • 👻 <b>Horror</b> • 😂 <b>Commedia</b>

${activeEvent ? `\n🎉 <b>EVENTO SPECIALE ATTIVO: ${activeEvent.name || activeEvent.title}</b> ${activeEvent.event_emoji || "🎃"}\n` : ""}
Ogni tema contiene storie infinite generate dall'AI! Sei pronto per intraprendere questo viaggio di saggezza e divertimento?

Usa /help per i comandi o scegli un tema qui sotto! 👇
  `,
    playerName,
  )

  const keyboard = {
    inline_keyboard: [
      ...(activeEvent
        ? [
            [
              {
                text: `${activeEvent.event_emoji || "🎉"} CONTEST - ${activeEvent.name || activeEvent.title}`,
                callback_data: `theme_${activeEvent.name}`,
              },
            ],
          ]
        : []),
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
      [
        { text: "📊 Le Mie Statistiche", callback_data: "show_stats" },
        { text: "🔗 Condividi Gioco", switch_inline_query: "invita amici" },
      ],
    ],
  }

  await bot.sendMessage(chatId, welcomeMessage, keyboard)
}
