import { type NextRequest, NextResponse } from "next/server"
import { TelegramBot } from "@/lib/telegram/bot"
import { logger } from "@/lib/debug/logger"
import { requireDebugAuth } from "@/lib/security/debug-auth"

const bot = new TelegramBot()

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  try {
    // Test if bot can make API calls
    const botInfo = await bot.getMe()
    logger.info("[test-inline] Bot info:", botInfo)

    // Check webhook info
    const webhookInfo = await bot.getWebhookInfo()
    logger.info("[test-inline] Webhook info:", webhookInfo)

    return NextResponse.json({
      success: true,
      botInfo,
      webhookInfo,
      message: "Bot is working. Check logs for inline query debugging.",
    })
  } catch (error) {
    logger.error("[test-inline] Debug test error:", error)
    return NextResponse.json(
      {
        error: "Bot test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
