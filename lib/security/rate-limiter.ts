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
    const now = new Date()
    const amsterdamTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }))

    if (this.isRateLimitingDisabled()) {
      console.log("[RateLimiter] Rate limiting disabled via DISABLE_RATE_LIMITS env var", { userId })
      return { allowed: true, currentTime: amsterdamTime }
    }

    try {
      const supabase = await createClient()

      const { data: rateLimit, error } = await supabase
        .from("rate_limits")
        .select("*")
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error("[RateLimiter] Rate limit check error:", error)
        return { allowed: true, currentTime: amsterdamTime } // Fail open
      }

      const nowTimestamp = now.getTime()

      if (!rateLimit) {
        // No record exists, create one
        if (shouldCount) {
          const { error: insertError } = await supabase.from("rate_limits").insert({
            user_id: userId,
            daily_count: 1,
            hourly_count: 1,
            burst_count: 1,
            last_daily_reset: this.getStartOfDay(amsterdamTime).toISOString(),
            last_hourly_reset: now.toISOString(),
            last_burst_reset: now.toISOString(),
          })

          if (insertError) {
            console.error("[RateLimiter] Insert error:", insertError)
          }
        }
        return { allowed: true, currentTime: amsterdamTime }
      }

      const hasNewColumns = "daily_count" in rateLimit && rateLimit.daily_count !== null

      if (!hasNewColumns) {
        // Legacy record with only date/request_count - use simple daily limit
        const recordDate = new Date(rateLimit.date)
        const todayStart = this.getStartOfDay(amsterdamTime)

        if (recordDate < todayStart) {
          // Old record, create new one for today
          if (shouldCount) {
            const { error: insertError } = await supabase.from("rate_limits").insert({
              user_id: userId,
              date: todayStart.toISOString().split("T")[0],
              request_count: 1,
              daily_count: 1,
              hourly_count: 1,
              burst_count: 1,
              last_daily_reset: todayStart.toISOString(),
              last_hourly_reset: now.toISOString(),
              last_burst_reset: now.toISOString(),
            })
            if (insertError) {
              console.error("[RateLimiter] Insert error:", insertError)
            }
          }
          return { allowed: true, currentTime: amsterdamTime }
        }

        // Same day, check request_count
        const requestCount = rateLimit.request_count || 0
        if (requestCount >= this.DEFAULT_DAILY_LIMIT) {
          return {
            allowed: false,
            reason: `Limite giornaliero raggiunto (${this.DEFAULT_DAILY_LIMIT}/giorno). Riprova domani!`,
            resetTime: this.getTomorrowMidnight(),
            currentTime: amsterdamTime,
          }
        }

        if (shouldCount) {
          await supabase
            .from("rate_limits")
            .update({ request_count: requestCount + 1 })
            .eq("id", rateLimit.id)
        }
        return { allowed: true, currentTime: amsterdamTime }
      }

      // New schema with daily/hourly/burst counters
      let dailyCount = rateLimit.daily_count || 0
      let hourlyCount = rateLimit.hourly_count || 0
      let burstCount = rateLimit.burst_count || 0

      const lastDailyReset = new Date(rateLimit.last_daily_reset || now)
      const lastHourlyReset = new Date(rateLimit.last_hourly_reset || now)
      const lastBurstReset = new Date(rateLimit.last_burst_reset || now)

      // Reset daily counter if day changed
      const startOfToday = this.getStartOfDay(amsterdamTime)
      if (lastDailyReset < startOfToday) {
        dailyCount = 0
      }

      // Reset hourly counter if more than 1 hour passed
      const hourInMs = 60 * 60 * 1000
      if (nowTimestamp - lastHourlyReset.getTime() >= hourInMs) {
        hourlyCount = 0
      }

      // Reset burst counter if burst window passed
      const burstWindowMs = this.DEFAULT_BURST_WINDOW * 1000
      if (nowTimestamp - lastBurstReset.getTime() >= burstWindowMs) {
        burstCount = 0
      }

      // 1. Check burst limit first (most restrictive short-term)
      if (burstCount >= this.DEFAULT_BURST_MAX) {
        const resetTime = new Date(lastBurstReset.getTime() + burstWindowMs)
        console.log("[RateLimiter] Burst limit exceeded", {
          userId,
          burstCount,
          limit: this.DEFAULT_BURST_MAX,
        })
        return {
          allowed: false,
          reason: `Troppo veloce! Attendi ${Math.ceil((resetTime.getTime() - nowTimestamp) / 1000)} secondi`,
          resetTime,
          currentTime: amsterdamTime,
        }
      }

      // 2. Check hourly limit
      if (hourlyCount >= this.DEFAULT_HOURLY_LIMIT) {
        const resetTime = new Date(lastHourlyReset.getTime() + hourInMs)
        console.log("[RateLimiter] Hourly limit exceeded", {
          userId,
          hourlyCount,
          limit: this.DEFAULT_HOURLY_LIMIT,
        })
        return {
          allowed: false,
          reason: `Limite orario raggiunto (${this.DEFAULT_HOURLY_LIMIT}/ora). Riprova tra ${Math.ceil((resetTime.getTime() - nowTimestamp) / 60000)} minuti`,
          resetTime,
          currentTime: amsterdamTime,
        }
      }

      // 3. Check daily limit
      if (dailyCount >= this.DEFAULT_DAILY_LIMIT) {
        const resetTime = this.getTomorrowMidnight()
        console.log("[RateLimiter] Daily limit exceeded", {
          userId,
          dailyCount,
          limit: this.DEFAULT_DAILY_LIMIT,
        })
        return {
          allowed: false,
          reason: `Limite giornaliero raggiunto (${this.DEFAULT_DAILY_LIMIT}/giorno). Riprova domani!`,
          resetTime,
          currentTime: amsterdamTime,
        }
      }

      if (shouldCount) {
        const updateData: Record<string, any> = {
          daily_count: dailyCount + 1,
          hourly_count: hourlyCount + 1,
          burst_count: burstCount + 1,
        }

        // Update reset timestamps if they were reset
        if (lastDailyReset < startOfToday) {
          updateData.last_daily_reset = startOfToday.toISOString()
        }
        if (nowTimestamp - lastHourlyReset.getTime() >= hourInMs) {
          updateData.last_hourly_reset = now.toISOString()
        }
        if (nowTimestamp - lastBurstReset.getTime() >= burstWindowMs) {
          updateData.last_burst_reset = now.toISOString()
        }

        const { error: updateError } = await supabase.from("rate_limits").update(updateData).eq("id", rateLimit.id)

        if (updateError) {
          console.error("[RateLimiter] Update error:", updateError)
        }
      }

      return { allowed: true, currentTime: amsterdamTime }
    } catch (error) {
      console.error("[RateLimiter] Rate limit error:", error)
      return { allowed: true, currentTime: amsterdamTime } // Fail open on error
    }
  }

  private static getStartOfDay(date: Date): Date {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    return startOfDay
  }

  private static getTomorrowMidnight(): Date {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow
  }
}
