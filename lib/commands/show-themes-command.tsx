import { TelegramBot } from "@/lib/telegram/bot"
import { EventManager } from "@/lib/story/event-manager"

const bot = new TelegramBot()

export async function handleShowThemes(callbackQuery: any, user: any) {
  const activeEvent = await EventManager.getActiveEvent()

  const keyboard: any = {
    inline_keyboard: [],
  }

  // Add event button if active
  if (activeEvent) {
    keyboard.inline_keyboard.push([
      {
        text: `${activeEvent.event_emoji || "🎉"} ${activeEvent.name || activeEvent.title} 🔥`,
        callback_data: `theme_${activeEvent.name}`,
      },
    ])
  }

  // Add regular themes
  keyboard.inline_keyboard.push(
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
  )

  const message = `
🎭 <b>Scegli il Tuo Tema</b>

Ciao ${user.first_name}! Seleziona un tema per iniziare la tua avventura:

${activeEvent ? `🔥 <b>${activeEvent.event_emoji} ${activeEvent.name || activeEvent.title}</b> - Evento Speciale! (${activeEvent.pp_multiplier}x PP)\n\n` : ""}Ogni tema offre storie uniche e infinite possibilità! ✨
  `

  await bot.editMessageText(callbackQuery.message.chat.id, callbackQuery.message.message_id, message, keyboard)
}
