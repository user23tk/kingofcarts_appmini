import { type NextRequest, NextResponse } from "next/server"
import { verify } from "jsonwebtoken"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const adminKey = process.env.DEBUG_ADMIN_KEY

    if (!adminKey) {
      logger.error("debug-verify-auth", "DEBUG_ADMIN_KEY not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    verify(token, adminKey)

    return NextResponse.json({ valid: true })
  } catch (error) {
    logger.warn("debug-verify-auth", "Invalid token verification attempt")
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }
}
