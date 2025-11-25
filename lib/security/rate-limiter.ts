import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"

export class AdvancedRateLimiter {
  private static readonly DEFAULT_DAILY_LIMIT = Number.parseInt(process.env.RATE_LIMIT_DAILY_MAX || "20")

  static isRateLimitingDisabled(): boolean {
    return process.env.DISABLE_RATE_LIMITS === "true"
  }

  static async checkRateLimit(
    userId: string,
    config?: any,
    shouldCount = true,
  ): Promise<{ allowed: boolean; reason?: string; resetTime?: Date; currentTime?: Date }> {
    const currentTime = new Date()
    const amsterdamTime = new Date(currentTime.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }))

    if (this.isRateLimitingDisabled()) {
      logger.debug("rate-limiter", "Rate limiting DISABLED - allowing all requests", { userId })
      return { allowed: true, currentTime: amsterdamTime }
    }

    const supabase = await createClient()

    logger.debug("rate-limiter", "Checking rate limit", {
      userId,
      shouldCount,
      dailyLimit: this.DEFAULT_DAILY_LIMIT,
      time: amsterdamTime.toISOString(),
    })

    try {
      const { data: isAllowed, error } = await supabase.rpc("check_rate_limit", {
        user_id_param: userId,
        daily_limit: this.DEFAULT_DAILY_LIMIT,
        should_count: shouldCount,
      })

      if (error) {
        logger.error("rate-limiter", "Rate limit RPC error", {
          error: error.message,
          code: error.code,
          details: error.details,
          userId,
        })
        // Fail open on database errors
        return { allowed: true, currentTime: amsterdamTime }
      }

      if (!isAllowed) {
        const reason = `Daily limit of ${this.DEFAULT_DAILY_LIMIT} requests exceeded`
        const resetTime = this.getTomorrowMidnight()

        logger.warn("rate-limiter", "Rate limit exceeded", { userId, dailyLimit: this.DEFAULT_DAILY_LIMIT })
        return {
          allowed: false,
          reason,
          resetTime,
          currentTime: amsterdamTime,
        }
      }

      logger.debug("rate-limiter", "Rate limit check passed", { userId, shouldCount, wasIncremented: shouldCount })
      return { allowed: true, currentTime: amsterdamTime }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error("rate-limiter", "Rate limit check error", { error: errorMessage, userId })
      // Fail open for system errors, but log for monitoring
      return { allowed: true, currentTime: amsterdamTime }
    }
  }

  private static getTomorrowMidnight(): Date {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    // Convert to Amsterdam timezone
    const amsterdamTomorrow = new Date(tomorrow.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }))
    return amsterdamTomorrow
  }
}
