import { type NextRequest, NextResponse } from "next/server"
import { TelegramBot } from "@/lib/telegram/bot"

const bot = new TelegramBot()

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const adminKey = request.nextUrl.searchParams.get("key")

  if (!adminKey || adminKey !== process.env.DEBUG_ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Test if bot can make API calls
    const botInfo = await bot.getMe()
    console.log("[v0] Bot info:", botInfo)

    // Check webhook info
    const webhookInfo = await bot.getWebhookInfo()
    console.log("[v0] Webhook info:", webhookInfo)

    return NextResponse.json({
      success: true,
      botInfo,
      webhookInfo,
      message: "Bot is working. Check logs for inline query debugging.",
    })
  } catch (error) {
    console.error("[v0] Debug test error:", error)
    return NextResponse.json(
      {
        error: "Bot test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
