import { type NextRequest, NextResponse } from "next/server"
import { sign } from "jsonwebtoken"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { adminKey } = await request.json()

    const validAdminKey = process.env.DEBUG_ADMIN_KEY

    if (!validAdminKey) {
      console.error("[v0] DEBUG_ADMIN_KEY environment variable not set")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    if (adminKey !== validAdminKey) {
      console.warn("[v0] Failed debug authentication attempt from:", request.ip || "unknown")
      return NextResponse.json({ error: "Invalid admin key" }, { status: 401 })
    }

    const token = sign(
      {
        authenticated: true,
        timestamp: Date.now(),
        ip: request.ip || "unknown",
      },
      validAdminKey,
      { expiresIn: "24h" },
    )

    console.log("[v0] Debug dashboard access granted to:", request.ip || "unknown")

    return NextResponse.json({ token })
  } catch (error) {
    console.error("[v0] Debug authentication error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
