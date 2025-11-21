import { TelegramBot } from "@/lib/telegram/bot"
import { StoryManager } from "@/lib/story/story-manager"
import { SessionManager } from "@/lib/story/session-manager"

const bot = new TelegramBot()
const storyManager = new StoryManager()
const sessionManager = new SessionManager()

export async function handleContinueStory(callbackQuery: any, user: any) {
  const theme = callbackQuery.data.replace("continue_", "")

  const themeProgress = await storyManager.getThemeProgress(user.id, theme)

  if (!themeProgress) {
    await bot.answerCallbackQuery(callbackQuery.id, "❌ Tema non trovato!")
    return
  }

  const chapter = await storyManager.getChapter(theme, themeProgress.current_chapter)

  if (!chapter) {
    await bot.editMessageText(
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      "❌ Capitolo non trovato! Usa /reset per ricominciare.",
    )
    return
  }

  const session = sessionManager.createSession(user.id)
  const playerName = user.first_name || "Viaggiatore"

  if (session.currentScene < chapter.scenes.length) {
    const scene = chapter.scenes[session.currentScene]
    const sceneText = storyManager.formatStoryText(scene.text, playerName, session.ppAccumulated)

    const keyboard = {
      inline_keyboard: scene.choices.map((choice: any) => [
        {
          text: `${choice.emoji || "▶️"} ${choice.text}`,
          callback_data: `choice_${theme}_${themeProgress.current_chapter}_${session.currentScene}_${scene.choices.indexOf(choice)}`,
        },
      ]),
    }

    await bot.editMessageText(callbackQuery.message.chat.id, callbackQuery.message.message_id, sceneText, keyboard)
  }
}
