import { createAdminClient } from "@/lib/supabase/admin"
import type { InlineKeyboardMarkup } from "./types"
import { AdvancedRateLimiter } from "../security/rate-limiter"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export class TelegramBot {
  private rateLimiter: AdvancedRateLimiter

  constructor() {
    this.rateLimiter = new AdvancedRateLimiter()
  }

  private async sendRequest(method: string, data: any) {
    const response = await fetch(`${TELEGRAM_API_URL}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`)
    }

    return response.json()
  }

  async sendMessage(chatId: number, text: string, replyMarkup?: InlineKeyboardMarkup) {
    return this.sendRequest("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    })
  }

  async editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: InlineKeyboardMarkup) {
    return this.sendRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    })
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    return this.sendRequest("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    })
  }

  async answerInlineQuery(
    inlineQueryId: string,
    results: any[],
    options?: {
      cache_time?: number
      is_personal?: boolean
      next_offset?: string
      switch_pm_text?: string
      switch_pm_parameter?: string
    },
  ) {
    const requestData: any = {
      inline_query_id: inlineQueryId,
      results,
      cache_time: options?.cache_time || 300,
      is_personal: options?.is_personal || false,
    }

    if (options?.next_offset) {
      requestData.next_offset = options.next_offset
    }

    if (options?.switch_pm_text && options?.switch_pm_parameter) {
      requestData.switch_pm_text = options.switch_pm_text
      requestData.switch_pm_parameter = options.switch_pm_parameter
    }

    return this.sendRequest("answerInlineQuery", requestData)
  }

  async getMe() {
    return this.sendRequest("getMe", {})
  }

  async getWebhookInfo() {
    return this.sendRequest("getWebhookInfo", {})
  }

  async setMyCommands(commands: Array<{ command: string; description: string }>) {
    return this.sendRequest("setMyCommands", {
      commands,
    })
  }

  async getOrCreateUser(telegramUser: any) {
    const supabase = createAdminClient()

    // Try to find existing user
    const { data: existingUser } = await supabase.from("users").select("*").eq("telegram_id", telegramUser.id).single()

    if (existingUser) {
      const needsUpdate =
        existingUser.username !== telegramUser.username ||
        existingUser.first_name !== telegramUser.first_name ||
        existingUser.last_name !== telegramUser.last_name ||
        existingUser.language_code !== telegramUser.language_code

      if (needsUpdate) {
        console.log(`[v0] User data changed, updating user ${telegramUser.id}`)
        const { data: updatedUser } = await supabase
          .from("users")
          .update({
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
            language_code: telegramUser.language_code,
            updated_at: new Date().toISOString(),
          })
          .eq("telegram_id", telegramUser.id)
          .select()
          .single()

        return updatedUser
      }

      return existingUser
    }

    console.log(`[v0] Creating new user ${telegramUser.id}`)
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        language_code: telegramUser.language_code || "en",
        is_bot: telegramUser.is_bot || false,
      })
      .select()
      .single()

    if (userError) {
      console.error(`[v0] Failed to create user ${telegramUser.id}:`, userError)
      throw new Error(`Failed to create user: ${userError.message}`)
    }

    if (!newUser) {
      console.error(`[v0] No data returned after creating user ${telegramUser.id}`)
      throw new Error("Failed to create user: no data returned")
    }

    console.log(`[v0] Creating initial user_progress for new user ${newUser.id}`)
    const { error: progressError } = await supabase.from("user_progress").insert({
      user_id: newUser.id,
      current_theme: "fantasy", // Default theme
      current_chapter: 1,
      completed_themes: [],
      chapters_completed: 0,
      themes_completed: 0,
      total_pp: 0,
      theme_progress: {},
    })

    if (progressError) {
      // Log but don't fail - user_progress can be created later
      console.error(`[v0] Failed to create user_progress for user ${newUser.id}:`, progressError)
    } else {
      console.log(`[v0] Successfully created user_progress for user ${newUser.id}`)
    }

    // Increment total users stat
    await supabase.rpc("increment_global_stat", {
      stat_name_param: "total_users",
    })

    return newUser
  }

  async getSupabaseClient() {
    return createAdminClient()
  }
}
