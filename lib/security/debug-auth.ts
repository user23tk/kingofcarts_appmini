import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/debug/logger"
import { timingSafeEqual } from "crypto"

/**
 * Centralized authentication middleware for debug endpoints
 * Validates admin key from headers and provides consistent error responses
 */
export async function requireDebugAuth(request: NextRequest): Promise<{
  authorized: boolean
  response?: NextResponse
  adminKey?: string
}> {
  // Check for admin key in multiple header formats
  const adminKey =
    request.headers.get("x-admin-key") || request.headers.get("authorization")?.replace("Bearer ", "") || null

  if (!adminKey) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized: Missing admin key" }, { status: 401 }),
    }
  }

  const validAdminKey = process.env.DEBUG_ADMIN_KEY

  if (!validAdminKey) {
    logger.error("debug-auth", "DEBUG_ADMIN_KEY not configured")
    return {
      authorized: false,
      response: NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
    }
  }

  // Use timing-safe comparison
  if (!timingSafeEqual(Buffer.from(adminKey), Buffer.from(validAdminKey))) {
    // Log failed attempt
    logger.warn("debug-auth", "Failed debug auth attempt", {
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      path: request.nextUrl.pathname,
    })

    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized: Invalid admin key" }, { status: 401 }),
    }
  }

  // Log successful auth
  logger.info("debug-auth", "Debug endpoint accessed", {
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    path: request.nextUrl.pathname,
  })

  return {
    authorized: true,
    adminKey,
  }
}

/**
 * Higher-order function that wraps route handlers with debug authentication
 * Simplifies endpoint protection by automatically applying requireDebugAuth
 */
export function withDebugAuth(
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const auth = await requireDebugAuth(req)
    if (!auth.authorized) {
      return auth.response!
    }
    return handler(req)
  }
}

/**
 * Rate limiting for debug endpoints
 * Tracks failed auth attempts per IP
 */
const failedAttempts = new Map<string, { count: number; resetAt: number }>()

export function checkDebugRateLimit(request: NextRequest): {
  allowed: boolean
  response?: NextResponse
} {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const now = Date.now()

  const attempts = failedAttempts.get(ip)

  if (attempts) {
    // Reset if window expired
    if (now > attempts.resetAt) {
      failedAttempts.delete(ip)
    } else if (attempts.count >= 5) {
      // Max 5 attempts per 5 minutes
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: "Too many failed authentication attempts. Try again later.",
            resetAt: new Date(attempts.resetAt).toISOString(),
          },
          { status: 429 },
        ),
      }
    }
  }

  return { allowed: true }
}

export function recordFailedDebugAuth(request: NextRequest): void {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const now = Date.now()
  const resetAt = now + 5 * 60 * 1000 // 5 minutes

  const attempts = failedAttempts.get(ip)

  if (attempts && now < attempts.resetAt) {
    attempts.count++
  } else {
    failedAttempts.set(ip, { count: 1, resetAt })
  }
}
