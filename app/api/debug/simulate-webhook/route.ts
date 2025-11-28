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

    const webhookData = await request.json()
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

    if (!webhookSecret) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"

    // Forward to the actual webhook endpoint with proper authentication
    const response = await fetch(`${baseUrl}/api/telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
      },
      body: JSON.stringify(webhookData),
    })

    if (response.ok) {
      return NextResponse.json({ success: true, message: "Webhook simulation completed" })
    } else {
      return NextResponse.json({ error: "Webhook simulation failed" }, { status: response.status })
    }
  } catch (error) {
    logger.error("[simulate-webhook] Webhook simulation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
