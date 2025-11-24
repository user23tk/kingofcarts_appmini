import { type NextRequest, NextResponse } from "next/server"
import { sign } from "jsonwebtoken"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { adminKey } = await request.json()

    const validAdminKey = process.env.DEBUG_ADMIN_KEY

    if (!validAdminKey) {
      logger.error("debug-authenticate", "DEBUG_ADMIN_KEY environment variable not set")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    if (adminKey !== validAdminKey) {
      logger.warn("debug-authenticate", "Failed debug authentication attempt", {
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      })
      return NextResponse.json({ error: "Invalid admin key" }, { status: 401 })
    }

    const token = sign(
      {
        authenticated: true,
        timestamp: Date.now(),
      },
      validAdminKey,
      { expiresIn: "24h" },
    )

    logger.info("debug-authenticate", "Debug dashboard access granted", {
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    })

    return NextResponse.json({ token })
  } catch (error) {
    logger.error("debug-authenticate", "Debug authentication error", { error })
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
