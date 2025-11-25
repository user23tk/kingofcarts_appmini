import { type NextRequest, NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase/admin-singleton"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_DEBUG_ROUTES) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const supabase = getAdminClient()

    logger.warn("debug-reset-global-stats", "Resetting global statistics - critical operation")

    const { error: globalError } = await supabase
      .from("global_stats")
      .update({
        stat_value: 0,
        updated_at: new Date().toISOString(),
      })
      .neq("stat_name", "dummy")

    if (globalError) {
      logger.error("debug-reset-global-stats", "Error resetting global stats", { error: globalError })
      return NextResponse.json({ error: "Failed to reset global stats" }, { status: 500 })
    }

    logger.warn("debug-reset-global-stats", "Global stats reset successfully")
    return NextResponse.json({ success: true, message: "Global statistics reset successfully" })
  } catch (error) {
    logger.error("debug-reset-global-stats", "Reset global stats error", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
