import { type NextRequest, NextResponse } from "next/server"

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
    console.error("[v0] [SECURITY] DEBUG_ADMIN_KEY not configured")
    return {
      authorized: false,
      response: NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
    }
  }

  // Use timing-safe comparison
  if (!timingSafeEqual(adminKey, validAdminKey)) {
    // Log failed attempt
    console.warn("[v0] [SECURITY] Failed debug auth attempt from:", {
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
  console.log("[v0] [SECURITY] Debug endpoint accessed:", {
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    path: request.nextUrl.pathname,
  })

  return {
    authorized: true,
    adminKey,
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
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
