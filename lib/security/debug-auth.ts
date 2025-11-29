import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/debug/logger"
import { verify } from "jsonwebtoken"

/**
 * Centralized authentication middleware for debug endpoints
 * Validates JWT token from Authorization header or raw admin key
 */
export async function requireDebugAuth(request: NextRequest): Promise<{
  authorized: boolean
  response?: NextResponse
  adminKey?: string
}> {
  const validAdminKey = process.env.DEBUG_ADMIN_KEY

  if (!validAdminKey) {
    logger.error("debug-auth", "DEBUG_ADMIN_KEY not configured")
    return {
      authorized: false,
      response: NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
    }
  }

  const authHeader = request.headers.get("authorization")
  const xAdminKey = request.headers.get("x-admin-key")
  const xDebugKey = request.headers.get("x-debug-key")

  // Extract Bearer token if present
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null

  // Try direct admin key first (for backwards compatibility)
  const directKey = xAdminKey || xDebugKey

  if (directKey === validAdminKey) {
    logger.info("debug-auth", "Debug endpoint accessed via direct key", {
      ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      path: request.nextUrl.pathname,
    })
    return {
      authorized: true,
      adminKey: validAdminKey,
    }
  }

  if (bearerToken) {
    try {
      const decoded = verify(bearerToken, validAdminKey) as { authenticated: boolean; timestamp: number }

      if (decoded.authenticated) {
        logger.info("debug-auth", "Debug endpoint accessed via JWT", {
          ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
          path: request.nextUrl.pathname,
        })
        return {
          authorized: true,
          adminKey: validAdminKey,
        }
      }
    } catch (jwtError) {
      // JWT verification failed, log and continue to failure
      logger.debug("debug-auth", "JWT verification failed", {
        error: jwtError instanceof Error ? jwtError.message : "Unknown error",
      })
    }
  }

  // No valid auth found
  logger.warn("debug-auth", "Failed debug auth attempt", {
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
    path: request.nextUrl.pathname,
    hasAuthHeader: !!authHeader,
    hasXAdminKey: !!xAdminKey,
    hasXDebugKey: !!xDebugKey,
  })

  return {
    authorized: false,
    response: NextResponse.json({ error: "Unauthorized: Invalid or missing authentication" }, { status: 401 }),
  }
}

/**
 * Higher-order function that wraps route handlers with debug authentication
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
    if (now > attempts.resetAt) {
      failedAttempts.delete(ip)
    } else if (attempts.count >= 5) {
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
  const resetAt = now + 5 * 60 * 1000

  const attempts = failedAttempts.get(ip)

  if (attempts && now < attempts.resetAt) {
    attempts.count++
  } else {
    failedAttempts.set(ip, { count: 1, resetAt })
  }
}
