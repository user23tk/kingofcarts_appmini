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

    // FORCE DISABLE RATE LIMIT
    console.log("rate-limiter", "Rate limiting GLOBALLY DISABLED", { userId })
    return { allowed: true, currentTime: amsterdamTime }

    /*
    if (this.isRateLimitingDisabled()) {
      // ... original logic commented out ...
    }
    */
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
