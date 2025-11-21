import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { adminKey, confirmText } = await request.json()

    if (!adminKey || adminKey !== process.env.DEBUG_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (confirmText !== "RESET ALL USERS") {
      return NextResponse.json({ error: "Confirmation text required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error: progressError } = await supabase.from("user_progress").delete().not("user_id", "is", null)

    if (progressError) {
      console.error("[v0] Error resetting all user progress:", progressError)
      return NextResponse.json({ error: "Failed to reset user progress" }, { status: 500 })
    }

    const { error: rateLimitError } = await supabase.from("rate_limits").delete().not("user_id", "is", null)

    if (rateLimitError) {
      console.error("[v0] Error resetting all rate limits:", rateLimitError)
    }

    console.log("[v0] All user stats reset successfully")
    return NextResponse.json({ success: true, message: "All user statistics reset successfully" })
  } catch (error) {
    console.error("[v0] Reset all users error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
