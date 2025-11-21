import { TelegramBot } from "@/lib/telegram/bot"
import { StoryManager } from "@/lib/story/story-manager"

const bot = new TelegramBot()
const storyManager = new StoryManager()

export async function handleStatsCommand(chatId: number, user: any) {
  const stats = await storyManager.getUserStats(user.id)
  const progress = await storyManager.getUserProgress(user.id)

  const statsMessage = `
📊 <b>Le Tue Statistiche</b>

👤 <b>Giocatore:</b> ${user.first_name}
🎯 <b>PP Totali:</b> ${stats.total_pp || 0}
📖 <b>Capitoli Completati:</b> ${stats.chapters_completed || 0}
🎭 <b>Tema Attuale:</b> ${progress?.current_theme || "Nessuno"}
📚 <b>Capitolo Attuale:</b> ${progress?.current_chapter || 0}

<i>"Ogni viaggio inizia con un singolo passo!" ✨</i>
  `

  const keyboard = {
    inline_keyboard: [
      [{ text: "🎭 Torna ai Temi", callback_data: "show_themes" }],
      [{ text: "▶️ Continua Storia", callback_data: `continue_${progress?.current_theme || ""}` }],
    ],
  }

  await bot.sendMessage(chatId, statsMessage, keyboard)
}
