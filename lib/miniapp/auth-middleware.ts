/**
 * Centralized Telegram MiniApp authentication middleware
 * Validates initData and provides consistent auth across all miniapp endpoints
 */

import { type NextRequest, NextResponse } from "next/server"
import { validateTelegramWebAppData, extractUserFromInitData } from "@/lib/telegram/webapp-auth"
import { TelegramBot } from "@/lib/telegram/bot"
import { QueryCache } from "@/lib/cache/query-cache"
import { logger } from "@/lib/debug/logger"

export interface TelegramAuthResult {
  authorized: boolean
  userId?: string
  telegramId?: number
  username?: string
  firstName?: string
  response?: NextResponse
  body?: Record<string, any>
}

/**
 * Validates Telegram WebApp initData and returns user information
 * Centralizes authentication logic to prevent repetition and ensure consistency
 *
 * IMPORTANT: This function consumes request.json(), so it returns the parsed body
 * for route handlers to use without re-parsing (which would fail)
 */
export async function requireTelegramAuth(request: NextRequest): Promise<TelegramAuthResult> {
  let body: Record<string, any> = {}

  try {
    body = await request.json()
    const { initData } = body

    if (!initData) {
      logger.warn("miniapp-auth", "Missing initData in request")
      return {
        authorized: false,
        response: NextResponse.json({ error: "Missing initData" }, { status: 400 }),
      }
    }

    // Validate Telegram WebApp data
    const validation = validateTelegramWebAppData(initData)

    if (!validation.valid || !validation.data) {
      logger.warn("miniapp-auth", "Invalid Telegram auth", { error: validation.error })
      return {
        authorized: false,
        response: NextResponse.json({ error: validation.error || "Invalid authentication data" }, { status: 401 }),
      }
    }

    // Extract user from validated data
    const telegramUser = extractUserFromInitData(validation.data)

    if (!telegramUser) {
      logger.warn("miniapp-auth", "User data not found in initData")
      return {
        authorized: false,
        response: NextResponse.json({ error: "User data not found" }, { status: 401 }),
      }
    }

    // Get or create user in database with caching
    const bot = new TelegramBot()
    const user = await QueryCache.get(
      `telegram_user:${telegramUser.id}`,
      async () => {
        return await bot.getOrCreateUser({
          id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          language_code: telegramUser.language_code,
          is_bot: false,
        })
      },
      60, // Cache for 1 minute
    )

    if (!user) {
      logger.error("miniapp-auth", "Failed to get or create user", { telegramId: telegramUser.id })
      return {
        authorized: false,
        response: NextResponse.json({ error: "Failed to get user" }, { status: 500 }),
      }
    }

    logger.debug("miniapp-auth", "User authenticated successfully", {
      userId: user.id,
      telegramId: user.telegram_id,
      username: user.username,
    })

    return {
      authorized: true,
      userId: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      firstName: user.first_name,
      body,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error("miniapp-auth", "Authentication error", { error: errorMessage, stack: errorStack })
    return {
      authorized: false,
      response: NextResponse.json({ error: "Authentication failed" }, { status: 500 }),
    }
  }
}

/**
 * Validates Telegram WebApp initData for GET requests
 * Extracts initData from the 'x-telegram-init-data' header or 'initData' query parameter
 */
export async function requireTelegramAuthGet(request: NextRequest): Promise<TelegramAuthResult> {
  try {
    let initData = request.headers.get("x-telegram-init-data")
    
    if (!initData) {
      const searchParams = request.nextUrl.searchParams
      initData = searchParams.get("initData")
    }

    if (!initData) {
      logger.warn("miniapp-auth", "Missing initData in GET request")
      return {
        authorized: false,
        response: NextResponse.json({ error: "Missing authentication data" }, { status: 401 }),
      }
    }

    // Validate Telegram WebApp data
    const validation = validateTelegramWebAppData(initData)

    if (!validation.valid || !validation.data) {
      logger.warn("miniapp-auth", "Invalid Telegram auth", { error: validation.error })
      return {
        authorized: false,
        response: NextResponse.json({ error: validation.error || "Invalid authentication data" }, { status: 401 }),
      }
    }

    const telegramUser = extractUserFromInitData(validation.data)

    if (!telegramUser) {
      return {
        authorized: false,
        response: NextResponse.json({ error: "User data not found" }, { status: 401 }),
      }
    }

    const bot = new TelegramBot()
    const user = await QueryCache.get(
      `telegram_user:${telegramUser.id}`,
      async () => {
        return await bot.getOrCreateUser({
          id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          language_code: telegramUser.language_code,
          is_bot: false,
        })
      },
      60,
    )

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json({ error: "Failed to get user" }, { status: 500 }),
      }
    }

    return {
      authorized: true,
      userId: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      firstName: user.first_name,
    }
  } catch (error) {
    logger.error("miniapp-auth", "GET Authentication error", { error })
    return {
      authorized: false,
      response: NextResponse.json({ error: "Authentication failed" }, { status: 500 }),
    }
  }
}

