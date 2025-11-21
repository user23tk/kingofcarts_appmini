import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET
    const appDomain = process.env.APP_DOMAIN || "https://v0-telegram-storytelling-bot.vercel.app"

    console.log("[v0] Bot token available:", !!botToken)
    console.log("[v0] Secret token available:", !!secretToken)

    if (!botToken) {
      console.log("[v0] ERROR: Bot token not configured")
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 })
    }

    if (!secretToken) {
      console.log("[v0] ERROR: Webhook secret not configured")
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    const webhookUrl = `${appDomain}/api/telegram`

    console.log("[v0] Configuring webhook URL:", webhookUrl)

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/setWebhook`

    console.log("[v0] Calling Telegram API:", telegramApiUrl)

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

    console.log("[v0] Telegram API response status:", response.status)
    console.log("[v0] Telegram API response:", JSON.stringify(result, null, 2))

    if (response.ok && result.ok) {
      console.log("[v0] Webhook configured successfully!")
      return NextResponse.json({
        success: true,
        message: "Webhook configured successfully",
        webhookUrl,
        result,
      })
    } else {
      console.log("[v0] ERROR: Webhook configuration failed:", result)
      return NextResponse.json(
        {
          error: result.description || "Failed to configure webhook",
          details: result,
        },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("[v0] Webhook configuration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
