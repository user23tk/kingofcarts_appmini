import { type NextRequest, NextResponse } from "next/server"
import { SecurityReportGenerator } from "@/lib/security/security-report"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // Verifica chiave admin per accesso al report di sicurezza
    const adminKey = request.headers.get("x-admin-key")
    const expectedAdminKey = process.env.DEBUG_ADMIN_KEY

    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[SECURITY] Generating security report...")
    const report = await SecurityReportGenerator.generateReport()

    console.log("[SECURITY] Security report generated successfully")
    return NextResponse.json(report)
  } catch (error) {
    console.error("[SECURITY] Error generating security report:", error)
    return NextResponse.json({ error: "Failed to generate security report" }, { status: 500 })
  }
}
