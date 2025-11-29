import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

/**
 * Standardized API Response Types for Debug Endpoints
 *
 * Usage:
 * - Success: return successResponse({ users: [...] })
 * - Error: return errorResponse("VALIDATION_ERROR", "Missing ID", 400)
 */

export type DebugApiSuccess<T> = {
  ok: true
  data: T
  timestamp: string
}

export type DebugApiError = {
  ok: false
  error: string
  message: string
  details?: unknown
}

export type DebugApiResponse<T> = DebugApiSuccess<T> | DebugApiError

/**
 * Create a standardized success response
 */
export function successResponse<T>(data: T, status = 200): NextResponse<DebugApiSuccess<T>> {
  return NextResponse.json(
    {
      ok: true as const,
      data,
      timestamp: new Date().toISOString(),
    },
    { status },
  )
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<DebugApiError> {
  return NextResponse.json(
    {
      ok: false as const,
      error: code,
      message,
      details: process.env.NODE_ENV === "development" ? details : undefined,
    },
    { status },
  )
}

/**
 * Common error codes for debug endpoints
 */
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_ID: "MISSING_ID",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
} as const

/**
 * Higher-order function that wraps route handlers with standard patterns:
 * - Authentication check
 * - Try/catch error handling
 * - Standardized logging
 *
 * Usage:
 * export const GET = withDebugHandler("endpoint-name", async (request) => {
 *   // Your logic here
 *   return successResponse({ data: "value" })
 * })
 */
export function withDebugHandler(
  endpointName: string,
  handler: (request: NextRequest) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    // Auth check
    const authCheck = await requireDebugAuth(request)
    if (!authCheck.authorized) {
      return authCheck.response!
    }

    try {
      return await handler(request)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      logger.error(endpointName, "Unhandled error", {
        error: errorMessage,
        stack: errorStack,
      })

      return errorResponse(ErrorCodes.INTERNAL_ERROR, "An unexpected error occurred", 500, errorMessage)
    }
  }
}

/**
 * Validation helpers
 */
export function validateRequiredParam(
  value: string | null | undefined,
  paramName: string,
): NextResponse<DebugApiError> | null {
  if (!value) {
    return errorResponse(ErrorCodes.MISSING_ID, `Missing required parameter: ${paramName}`, 400)
  }
  return null
}

/**
 * Parse JSON body safely
 */
export async function parseJsonBody<T>(
  request: NextRequest,
): Promise<{ data: T } | { error: NextResponse<DebugApiError> }> {
  try {
    const data = await request.json()
    return { data: data as T }
  } catch {
    return {
      error: errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid JSON body", 400),
    }
  }
}
