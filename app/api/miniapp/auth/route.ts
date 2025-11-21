import { type NextRequest, NextResponse } from "next/server"
import { validateTelegramWebAppData, extractUserFromInitData } from "@/lib/telegram/webapp-auth"
import { TelegramBot } from "@/lib/telegram/bot"
import { sign } from "jsonwebtoken"
import { MiniAppSecurity } from "@/lib/security/miniapp-security"

const JWT_SECRET = process.env.JWT_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  try {
    if (!JWT_SECRET) {
      console.error("[v0] [SECURITY] JWT_SECRET not configured")
      return NextResponse.json({ error: "Server configuration error: JWT secret not set" }, { status: 500 })
    }

    const body = await request.json()
    const { initData } = body

    if (!initData) {
      return NextResponse.json({ error: "Missing initData" }, { status: 400 })
    }

    // Validate Telegram WebApp data
    const validation = validateTelegramWebAppData(initData)

    if (!validation.valid || !validation.data) {
      console.error("[v0] Invalid Telegram auth:", validation.error)
      return NextResponse.json({ error: validation.error || "Invalid authentication data" }, { status: 401 })
    }

    // Extract user from validated data
    const telegramUser = extractUserFromInitData(validation.data)

    if (!telegramUser) {
      return NextResponse.json({ error: "User data not found" }, { status: 401 })
    }

    // Get or create user in database
    const bot = new TelegramBot()
    const user = await bot.getOrCreateUser({
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      language_code: telegramUser.language_code,
      is_bot: false,
    })

    if (!user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    await MiniAppSecurity.auditLog({
      user_id: user.id,
      action: "AUTHENTICATE",
      resource: "auth",
      details: {
        telegram_id: user.telegram_id,
        username: user.username,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    // Create session token
    const token = sign(
      {
        userId: user.id,
        telegramId: user.telegram_id,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    )

    console.log("[v0] User authenticated via Mini App:", {
      userId: user.id,
      telegramId: user.telegram_id,
      username: user.username,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      token,
    })
  } catch (error) {
    console.error("[v0] Auth error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
