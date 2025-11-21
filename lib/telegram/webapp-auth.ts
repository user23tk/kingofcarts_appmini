// Telegram Mini App WebApp SDK integration and authentication utilities

import crypto from "crypto"

export interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface TelegramWebAppInitData {
  query_id?: string
  user?: TelegramWebAppUser
  receiver?: TelegramWebAppUser
  chat?: any
  chat_type?: string
  chat_instance?: string
  start_param?: string
  can_send_after?: number
  auth_date: number
  hash: string
}

/**
 * Validates Telegram WebApp initData using HMAC-SHA256
 * This ensures the data comes from Telegram and hasn't been tampered with
 */
export function validateTelegramWebAppData(initData: string): {
  valid: boolean
  data?: TelegramWebAppInitData
  error?: string
} {
  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    if (!BOT_TOKEN) {
      return { valid: false, error: "Bot token not configured" }
    }

    // Parse the initData string
    const params = new URLSearchParams(initData)
    const hash = params.get("hash")

    if (!hash) {
      return { valid: false, error: "Hash not found in initData" }
    }

    // Remove hash from params for validation
    params.delete("hash")

    // Sort params alphabetically and create data-check-string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

    // Create secret key using HMAC-SHA256 with "WebAppData" constant
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest()

    // Calculate hash
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

    // Verify hash matches
    if (calculatedHash !== hash) {
      return { valid: false, error: "Invalid hash - data may be tampered" }
    }

    // Check auth_date is recent (within 24 hours)
    const authDate = Number.parseInt(params.get("auth_date") || "0")
    const now = Math.floor(Date.now() / 1000)
    const maxAge = 24 * 60 * 60 // 24 hours

    if (now - authDate > maxAge) {
      return { valid: false, error: "Auth data expired" }
    }

    // Parse user data
    const userData = params.get("user")
    const user = userData ? JSON.parse(userData) : undefined

    const validatedData: TelegramWebAppInitData = {
      query_id: params.get("query_id") || undefined,
      user,
      auth_date: authDate,
      hash,
      start_param: params.get("start_app") || undefined,
    }

    return { valid: true, data: validatedData }
  } catch (error) {
    return {
      valid: false,
      error: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

/**
 * Extracts user info from validated initData
 */
export function extractUserFromInitData(initData: TelegramWebAppInitData): TelegramWebAppUser | null {
  return initData.user || null
}

/**
 * Client-side utility to get Telegram WebApp instance
 * This should be called in the browser only
 */
export function getTelegramWebApp() {
  if (typeof window === "undefined") {
    return null
  }

  // @ts-ignore - Telegram WebApp is injected by Telegram
  return window.Telegram?.WebApp || null
}

/**
 * Client-side utility to check if running inside Telegram
 */
export function isRunningInTelegram(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  // @ts-ignore
  return !!window.Telegram?.WebApp
}
