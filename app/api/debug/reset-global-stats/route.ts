import { type NextRequest, NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase/admin-singleton"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ENABLE_DEBUG_ROUTES) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const { adminKey } = await request.json()

    if (!adminKey || adminKey !== process.env.DEBUG_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { error: globalError } = await supabase
      .from("global_stats")
      .update({
        stat_value: 0,
        updated_at: new Date().toISOString(),
      })
      .neq("stat_name", "dummy")

    if (globalError) {
      console.error("[v0] Error resetting global stats:", globalError)
      return NextResponse.json({ error: "Failed to reset global stats" }, { status: 500 })
    }

    console.log("[v0] Global stats reset successfully")
    return NextResponse.json({ success: true, message: "Global statistics reset successfully" })
  } catch (error) {
    console.error("[v0] Reset global stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
