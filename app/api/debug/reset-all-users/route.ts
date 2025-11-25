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
    const { confirmText } = await request.json()

    if (confirmText !== "RESET ALL USERS") {
      return NextResponse.json({ error: "Confirmation text required" }, { status: 400 })
    }

    const supabase = getAdminClient()

    logger.warn("debug-reset-all-users", "Resetting ALL user data - critical operation")

    const { error: progressError } = await supabase.from("user_progress").delete().not("user_id", "is", null)

    if (progressError) {
      logger.error("debug-reset-all-users", "Error resetting all user progress", { error: progressError })
      return NextResponse.json({ error: "Failed to reset user progress" }, { status: 500 })
    }

    const { error: rateLimitError } = await supabase.from("rate_limits").delete().not("user_id", "is", null)

    if (rateLimitError) {
      logger.error("debug-reset-all-users", "Error resetting all rate limits", { error: rateLimitError })
    }

    logger.warn("debug-reset-all-users", "All user stats reset successfully")
    return NextResponse.json({ success: true, message: "All user statistics reset successfully" })
  } catch (error) {
    logger.error("debug-reset-all-users", "Reset all users error", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
