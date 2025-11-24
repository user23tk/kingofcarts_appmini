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

Ogni tema contiene storie infinite generate dall'AI! Apri la Mini App per iniziare la tua avventura! 🎮
  `,
    playerName,
  )

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🎮 Apri King of Carts",
          web_app: { url: process.env.APP_DOMAIN || "https://v0-beta-3-mini-app.vercel.app" },
        },
      ],
      [
        {
          text: "🔗 Condividi con Amici",
          switch_inline_query: "Unisciti a me in King of Carts! 🎭",
        },
      ],
    ],
  }

  await bot.sendMessage(chatId, welcomeMessage, keyboard)
}
