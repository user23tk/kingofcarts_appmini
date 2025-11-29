import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/debug/logger"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireDebugAuth(request)
    if (!authCheck.authorized) {
      return authCheck.response!
    }

    logger.info("[test-telegram-endpoint] Testing Telegram endpoint...")

    // Test if we can receive a webhook-like request
    const body = await request.json()
    logger.debug("[test-telegram-endpoint] Test request body:", JSON.stringify(body, null, 2))

    // Check headers
    const headers = Object.fromEntries(request.headers.entries())
    logger.debug("[test-telegram-endpoint] Test request headers:", JSON.stringify(headers, null, 2))

    // Test secret token validation
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET
    const receivedToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token")

    logger.debug("[test-telegram-endpoint] Expected secret token:", !!secretToken)
    logger.debug("[test-telegram-endpoint] Received secret token:", !!receivedToken)
    logger.debug("[test-telegram-endpoint] Tokens match:", secretToken === receivedToken)

    return NextResponse.json({
      success: true,
      message: "Telegram endpoint test completed",
      secretTokenConfigured: !!secretToken,
      secretTokenReceived: !!receivedToken,
      tokensMatch: secretToken === receivedToken,
      headers: headers,
      body: body,
    })
  } catch (error) {
    logger.error("[test-telegram-endpoint] Test endpoint error:", error)
    return NextResponse.json(
      { error: "Test failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  return NextResponse.json({
    message: "Telegram endpoint test - use POST with JSON body to simulate webhook",
  })
}
