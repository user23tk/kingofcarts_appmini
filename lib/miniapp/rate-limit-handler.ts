import { AdvancedRateLimiter } from "@/lib/security/rate-limiter"

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  resetTime?: Date
  remainingRequests?: number
}

export class MiniAppRateLimiter {
  /**
   * Check rate limit for Mini App API calls
   * @param userId - User ID (UUID from database)
   * @param shouldCount - Whether to count this check towards the limit (default: true)
   * @returns Rate limit result with allowed status
   */
  static async checkLimit(userId: string, shouldCount = true): Promise<RateLimitResult> {
    try {
      const result = await AdvancedRateLimiter.checkRateLimit(userId, undefined, shouldCount)

      return {
        allowed: result.allowed,
        reason: result.reason,
        resetTime: result.resetTime,
      }
    } catch (error) {
      console.error("[v0] Rate limit check error:", error)
      // Fail open on errors to not block users
      return { allowed: true }
    }
  }

  /**
   * Format rate limit error response for client
   */
  static formatErrorResponse(result: RateLimitResult) {
    const resetTime = result.resetTime ? result.resetTime.toISOString() : undefined

    return {
      error: "Rate limit exceeded",
      message: result.reason || "Too many requests. Please try again later.",
      resetTime,
      code: "RATE_LIMIT_EXCEEDED",
    }
  }

  /**
   * Check if rate limiting is disabled (for development)
   */
  static isDisabled(): boolean {
    return AdvancedRateLimiter.isRateLimitingDisabled()
  }
}
