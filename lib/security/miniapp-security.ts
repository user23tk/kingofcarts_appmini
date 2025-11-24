import { createAdminClient } from "@/lib/supabase/admin"
import { MiniAppRateLimiter } from "@/lib/miniapp/rate-limit-handler"

export interface SecurityValidation {
  valid: boolean
  userId?: string
  error?: string
}

export interface AuditLogEntry {
  user_id: string
  action: string
  resource: string
  details?: Record<string, any>
  ip_address?: string
  user_agent?: string
}

/**
 * Security layer for Mini App APIs
 * Provides authorization, audit logging, rate limiting, and input validation
 * Note: Authentication is handled by Telegram WebApp, not JWT tokens
 */
export class MiniAppSecurity {
  /**
   * Validate user ID format
   */
  static validateUserId(userId: string): SecurityValidation {
    // Validate userId format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return { valid: false, error: "Invalid userId format" }
    }
    return { valid: true, userId }
  }

  /**
   * Check rate limits for the user
   */
  static async checkRateLimit(userId: string, shouldCount = true) {
    return await MiniAppRateLimiter.checkLimit(userId, shouldCount)
  }

  /**
   * Log security-relevant actions for audit trail
   */
  static async auditLog(entry: AuditLogEntry): Promise<void> {
    try {
      const supabase = createAdminClient()

      // Create audit log entry
      const { error } = await supabase.from("audit_logs").insert({
        user_id: entry.user_id,
        action: entry.action,
        resource: entry.resource,
        details: entry.details || {},
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        created_at: new Date().toISOString(),
      })

      if (error) {
        console.error("[v0] [SECURITY] Failed to create audit log:", error)
      }
    } catch (error) {
      // Don't fail the request if audit logging fails
      console.error("[v0] [SECURITY] Audit log error:", error)
    }
  }

  /**
   * Validate and sanitize user input
   */
  static validateInput(input: {
    userId?: string
    theme?: string
    choiceId?: string
    sceneIndex?: number
  }): { valid: boolean; error?: string } {
    // Validate userId format (UUID)
    if (input.userId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.userId)) {
      return { valid: false, error: "Invalid userId format" }
    }

    // Validate theme (alphanumeric and hyphens only)
    if (input.theme && !/^[a-z0-9-]+$/i.test(input.theme)) {
      return { valid: false, error: "Invalid theme format" }
    }

    // Validate choiceId (alphanumeric only)
    if (input.choiceId && !/^[a-z0-9_]+$/i.test(input.choiceId)) {
      return { valid: false, error: "Invalid choiceId format" }
    }

    // Validate sceneIndex (0-9 only)
    if (input.sceneIndex !== undefined && (input.sceneIndex < 0 || input.sceneIndex > 9)) {
      return { valid: false, error: "Invalid sceneIndex: must be between 0 and 9" }
    }

    return { valid: true }
  }

  /**
   * Lightweight security check for read-only endpoints (dashboard, profile, leaderboard)
   * Only validates userId format and logs access - does NOT check rate limits
   */
  static async validateReadOnlyRequest(
    requestedUserId: string,
    action: string,
    resource: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: true; userId: string } | { success: false; error: string; status: number }> {
    // 1. Validate userId format
    const validation = this.validateUserId(requestedUserId)
    if (!validation.valid) {
      return { success: false, error: validation.error || "Invalid userId", status: 400 }
    }

    // 2. Audit log the access (no rate limiting for read-only)
    await this.auditLog({
      user_id: requestedUserId,
      action,
      resource,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    return { success: true, userId: requestedUserId }
  }

  /**
   * Complete security check for Mini App API requests
   * Returns userId if all checks pass, or error response
   * @param shouldCount - Whether to count this request towards rate limit (default: true)
   */
  static async validateRequest(
    requestedUserId: string,
    action: string,
    resource: string,
    ipAddress?: string,
    userAgent?: string,
    shouldCount = true,
  ): Promise<{ success: true; userId: string } | { success: false; error: string; status: number }> {
    // 1. Validate userId format
    const validation = this.validateUserId(requestedUserId)
    if (!validation.valid) {
      return { success: false, error: validation.error || "Invalid userId", status: 400 }
    }

    // 2. Check rate limits with shouldCount parameter
    const rateLimitResult = await this.checkRateLimit(requestedUserId, shouldCount)
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. ${rateLimitResult.reason || ""} Reset at: ${rateLimitResult.resetTime?.toISOString() || "tomorrow"}`,
        status: 429,
      }
    }

    // 3. Audit log the access
    await this.auditLog({
      user_id: requestedUserId,
      action,
      resource,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    return { success: true, userId: requestedUserId }
  }
}
