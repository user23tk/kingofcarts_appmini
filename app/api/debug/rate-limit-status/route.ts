import { type NextRequest, NextResponse } from "next/server"
import { AdvancedRateLimiter } from "@/lib/security/rate-limiter"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireDebugAuth(request)
    if (!authCheck.authorized) {
      return authCheck.response!
    }

    const isDisabled = AdvancedRateLimiter.isRateLimitingDisabled()

    const config = {
      dailyLimit: Number.parseInt(process.env.RATE_LIMIT_DAILY_MAX || "20"),
      hourlyLimit: Number.parseInt(process.env.RATE_LIMIT_HOURLY_MAX || "10"),
      burstLimit: Number.parseInt(process.env.RATE_LIMIT_BURST_MAX || "3"),
      burstWindow: Number.parseInt(process.env.RATE_LIMIT_BURST_WINDOW_SECONDS || "60"),
    }

    logger.debug(`[rate-limit-status] Rate limiting status requested - disabled: ${isDisabled}`)

    return NextResponse.json({
      isDisabled,
      config,
    })
  } catch (error) {
    logger.error("[rate-limit-status] Error fetching rate limit status:", error)
    return NextResponse.json({ error: "Failed to fetch rate limit status" }, { status: 500 })
  }
}
