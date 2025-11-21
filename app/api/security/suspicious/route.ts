import { type NextRequest, NextResponse } from "next/server"
import { PPValidator } from "@/lib/security/pp-validator"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // Verifica chiave admin
    const adminKey = request.headers.get("x-admin-key")
    const expectedAdminKey = process.env.DEBUG_ADMIN_KEY

    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[SECURITY] Checking for suspicious PP patterns...")
    const suspiciousPatterns = await PPValidator.detectSuspiciousPatterns()

    console.log(`[SECURITY] Found ${suspiciousPatterns.length} suspicious patterns`)
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      suspicious_patterns: suspiciousPatterns,
      total_found: suspiciousPatterns.length,
    })
  } catch (error) {
    console.error("[SECURITY] Error checking suspicious patterns:", error)
    return NextResponse.json({ error: "Failed to check suspicious patterns" }, { status: 500 })
  }
}
