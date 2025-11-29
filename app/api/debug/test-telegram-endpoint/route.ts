import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Testing Telegram endpoint...")

    // Test if we can receive a webhook-like request
    const body = await request.json()
    console.log("[v0] Test request body:", JSON.stringify(body, null, 2))

    // Check headers
    const headers = Object.fromEntries(request.headers.entries())
    console.log("[v0] Test request headers:", JSON.stringify(headers, null, 2))

    // Test secret token validation
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET
    const receivedToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token")

    console.log("[v0] Expected secret token:", !!secretToken)
    console.log("[v0] Received secret token:", !!receivedToken)
    console.log("[v0] Tokens match:", secretToken === receivedToken)

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
    console.error("[v0] Test endpoint error:", error)
    return NextResponse.json({ error: "Test failed", details: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Telegram endpoint test - use POST with JSON body to simulate webhook",
  })
}
