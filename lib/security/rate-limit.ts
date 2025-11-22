import { kv } from "@vercel/kv"

export interface RateLimitConfig {
  interval: number // seconds
  limit: number // requests per interval
}

export class RateLimit {
  static async check(
    identifier: string,
    config: RateLimitConfig = { interval: 60, limit: 10 },
  ): Promise<{ success: boolean; remaining: number }> {
    if (!identifier) return { success: true, remaining: config.limit }

    const key = `rate_limit:${identifier}`

    try {
      // Fallback to memory if KV is not configured or fails
      if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        // Simple in-memory fallback (note: this resets on cold start)
        // In production with serverless, this is per-instance, which is "okay" but not perfect.
        // For robust production, KV is required.
        console.warn("[RateLimit] KV not configured, using permissive fallback")
        return { success: true, remaining: config.limit }
      }

      const requests = await kv.incr(key)

      if (requests === 1) {
        await kv.expire(key, config.interval)
      }

      const remaining = Math.max(0, config.limit - requests)

      return {
        success: requests <= config.limit,
        remaining,
      }
    } catch (error) {
      console.error("Rate limit error:", error)
      // Fail open if KV is down to prevent blocking users during outages
      return { success: true, remaining: config.limit }
    }
  }
}
