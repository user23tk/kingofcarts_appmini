import { createClient } from "@/lib/supabase/server"

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
      console.log(`[v0] [SECURITY] Rate limiting DISABLED - allowing all requests for user ${userId}`)
      return { allowed: true, currentTime: amsterdamTime }
    }

    const supabase = await createClient()

    console.log(`[v0] [SECURITY] Rate limit check for user ${userId} at ${amsterdamTime.toISOString()}`)
    console.log(`[v0] [SECURITY] Should count towards limit: ${shouldCount}`)
    console.log(`[v0] [SECURITY] Config: daily=${this.DEFAULT_DAILY_LIMIT}`)

    try {
      const { data: isAllowed } = await supabase.rpc("check_rate_limit", {
        user_id_param: userId,
        daily_limit: this.DEFAULT_DAILY_LIMIT,
      })

      if (!isAllowed) {
        const reason = `Daily limit of ${this.DEFAULT_DAILY_LIMIT} requests exceeded`
        const resetTime = this.getTomorrowMidnight()

        console.log(`[v0] [SECURITY] Rate limit exceeded for user ${userId}`)
        return {
          allowed: false,
          reason,
          resetTime,
          currentTime: amsterdamTime,
        }
      }

      console.log(`[v0] [SECURITY] Rate limit passed for user ${userId}`)
      return { allowed: true, currentTime: amsterdamTime }
    } catch (error) {
      console.error(`[v0] [SECURITY] Rate limit check error for user ${userId}:`, error)
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
