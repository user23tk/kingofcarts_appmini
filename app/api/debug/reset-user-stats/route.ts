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
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single()

    if (userError || !userData) {
      logger.error("debug-reset-user-stats", "User not found", { error: userError, userId })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const actualUserId = userData.id

    const { error: progressError } = await supabase.from("user_progress").delete().eq("user_id", actualUserId)

    if (progressError) {
      logger.error("debug-reset-user-stats", "Error resetting user progress", { error: progressError })
      return NextResponse.json({ error: "Failed to reset user progress" }, { status: 500 })
    }

    const { error: rateLimitError } = await supabase.from("rate_limits").delete().eq("user_id", actualUserId)

    if (rateLimitError) {
      logger.error("debug-reset-user-stats", "Error resetting rate limits", { error: rateLimitError })
    }

    logger.info("debug-reset-user-stats", "User stats reset successfully", { telegramId: userId })
    return NextResponse.json({ success: true, message: `User statistics reset successfully for telegram_id ${userId}` })
  } catch (error) {
    logger.error("debug-reset-user-stats", "Reset user stats error", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
