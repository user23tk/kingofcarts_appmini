import { createClient } from "@/lib/supabase/server"

export class AdvancedRateLimiter {
  private static readonly DEFAULT_DAILY_LIMIT = Number.parseInt(process.env.RATE_LIMIT_DAILY_MAX || "50")
  private static readonly DEFAULT_HOURLY_LIMIT = Number.parseInt(process.env.RATE_LIMIT_HOURLY_MAX || "10")
  private static readonly DEFAULT_BURST_MAX = Number.parseInt(process.env.RATE_LIMIT_BURST_MAX || "3")
  private static readonly DEFAULT_BURST_WINDOW = Number.parseInt(process.env.RATE_LIMIT_BURST_WINDOW_SECONDS || "60")

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
      console.log("[v0] Rate limiting disabled via DISABLE_RATE_LIMITS env var", { userId })
      return { allowed: true, currentTime: amsterdamTime }
    }

    try {
      const supabase = await createClient()

      // Get or create rate limit record
      const { data: rateLimit, error } = await supabase.from("rate_limits").select("*").eq("user_id", userId).single()

      if (error && error.code !== "PGRST116") {
        console.error("[v0] Rate limit check error:", error)
        return { allowed: true, currentTime: amsterdamTime } // Fail open
      }

      const now = amsterdamTime.getTime()
      const oneDayAgo = now - 24 * 60 * 60 * 1000
      const oneHourAgo = now - 60 * 60 * 1000
      const burstWindowAgo = now - this.DEFAULT_BURST_WINDOW * 1000

      if (!rateLimit) {
        // First request - create record
        if (shouldCount) {
          await supabase.from("rate_limits").insert({
            user_id: userId,
            daily_count: 1,
            hourly_count: 1,
            burst_count: 1,
            last_daily_reset: amsterdamTime.toISOString(),
            last_hourly_reset: amsterdamTime.toISOString(),
            last_burst_reset: amsterdamTime.toISOString(),
          })
        }
        return { allowed: true, currentTime: amsterdamTime }
      }

      // Check if we need to reset counters
      const lastDailyReset = new Date(rateLimit.last_daily_reset).getTime()
      const lastHourlyReset = new Date(rateLimit.last_hourly_reset).getTime()
      const lastBurstReset = new Date(rateLimit.last_burst_reset).getTime()

      let dailyCount = rateLimit.daily_count || 0
      let hourlyCount = rateLimit.hourly_count || 0
      let burstCount = rateLimit.burst_count || 0

      // Reset daily counter if 24 hours passed
      if (lastDailyReset < oneDayAgo) {
        dailyCount = 0
      }

      // Reset hourly counter if 1 hour passed
      if (lastHourlyReset < oneHourAgo) {
        hourlyCount = 0
      }

      // Reset burst counter if burst window passed
      if (lastBurstReset < burstWindowAgo) {
        burstCount = 0
      }

      // Check limits
      if (dailyCount >= this.DEFAULT_DAILY_LIMIT) {
        const resetTime = this.getTomorrowMidnight()
        console.log("[v0] Daily rate limit exceeded", { userId, dailyCount, limit: this.DEFAULT_DAILY_LIMIT })
        return {
          allowed: false,
          reason: "Daily limit exceeded",
          resetTime,
          currentTime: amsterdamTime,
        }
      }

      if (hourlyCount >= this.DEFAULT_HOURLY_LIMIT) {
        const resetTime = new Date(lastHourlyReset + 60 * 60 * 1000)
        console.log("[v0] Hourly rate limit exceeded", { userId, hourlyCount, limit: this.DEFAULT_HOURLY_LIMIT })
        return {
          allowed: false,
          reason: "Hourly limit exceeded",
          resetTime,
          currentTime: amsterdamTime,
        }
      }

      if (burstCount >= this.DEFAULT_BURST_MAX) {
        const resetTime = new Date(lastBurstReset + this.DEFAULT_BURST_WINDOW * 1000)
        console.log("[v0] Burst rate limit exceeded", { userId, burstCount, limit: this.DEFAULT_BURST_MAX })
        return {
          allowed: false,
          reason: "Too many requests in short time",
          resetTime,
          currentTime: amsterdamTime,
        }
      }

      // Update counters if shouldCount is true
      if (shouldCount) {
        const updates: any = {
          daily_count: dailyCount + 1,
          hourly_count: hourlyCount + 1,
          burst_count: burstCount + 1,
        }

        if (lastDailyReset < oneDayAgo) {
          updates.last_daily_reset = amsterdamTime.toISOString()
        }
        if (lastHourlyReset < oneHourAgo) {
          updates.last_hourly_reset = amsterdamTime.toISOString()
        }
        if (lastBurstReset < burstWindowAgo) {
          updates.last_burst_reset = amsterdamTime.toISOString()
        }

        await supabase.from("rate_limits").update(updates).eq("user_id", userId)
      }

      return { allowed: true, currentTime: amsterdamTime }
    } catch (error) {
      console.error("[v0] Rate limit error:", error)
      return { allowed: true, currentTime: amsterdamTime } // Fail open on error
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
