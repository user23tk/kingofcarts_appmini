import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET
    const appDomain = (process.env.APP_DOMAIN || "https://v0-telegram-storytelling-bot.vercel.app").replace(/\/$/, "")

    logger.info("debug-configure-webhook", "Configuring webhook", {
      hasBotToken: !!botToken,
      hasSecretToken: !!secretToken,
      appDomain,
    })

    if (!botToken) {
      logger.error("debug-configure-webhook", "Bot token not configured")
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
    }

    if (!secretToken) {
      logger.error("debug-configure-webhook", "Webhook secret not configured")
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    const webhookUrl = `${appDomain}/api/telegram`

    logger.info("debug-configure-webhook", "Setting webhook URL", { webhookUrl })

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/setWebhook`

    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ["message", "callback_query", "inline_query"],
        drop_pending_updates: true,
      }),
    })

    const result = await response.json()

    logger.info("debug-configure-webhook", "Telegram API response", {
      status: response.status,
      ok: result.ok,
    })

    if (response.ok && result.ok) {
      logger.info("debug-configure-webhook", "Webhook configured successfully")
      return NextResponse.json({
        success: true,
        message: "Webhook configured successfully",
        webhookUrl,
        result,
      })
    } else {
      logger.error("debug-configure-webhook", "Webhook configuration failed", { result })
      return NextResponse.json(
        {
          error: result.description || "Failed to configure webhook",
          details: result,
        },
        { status: 400 },
      )
    }
  } catch (error) {
    logger.error("debug-configure-webhook", "Webhook configuration error", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
