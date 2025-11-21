import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireDebugAuth, checkDebugRateLimit } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const rateLimitCheck = checkDebugRateLimit(request)
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response!
    }

    const authCheck = await requireDebugAuth(request)
    if (!authCheck.authorized) {
      return authCheck.response!
    }

    const supabase = await createClient()

    const { data: users, error } = await supabase
      .from("users")
      .select("id, telegram_id, first_name, username, created_at")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) throw error

    console.log("[v0] [SECURITY] Users list accessed by admin")

    return NextResponse.json(users || [])
  } catch (error) {
    console.error("[v0] Debug users error:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}
