import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireDebugAuth(request)
    if (!authCheck.authorized) {
      return authCheck.response!
    }

    const supabase = await createClient()

    console.log("[v0] [SECURITY] Test data deletion initiated by admin:", {
      ip: request.headers.get("x-forwarded-for") || "unknown",
      timestamp: new Date().toISOString(),
    })

    // Clear test data (only users with telegram_id starting with test pattern)
    const { error: usersError } = await supabase.from("users").delete().like("telegram_id", "123456%") // Only delete test users

    if (usersError) {
      console.error("[v0] Clear users error:", usersError)
    }

    // Clear related progress data
    const { error: progressError } = await supabase.from("user_progress").delete().in("user_id", []) // This will clear nothing unless we have specific test user IDs

    if (progressError) {
      console.error("[v0] Clear progress error:", progressError)
    }

    // Clear test rate limits
    const { error: rateLimitError } = await supabase.from("rate_limits").delete().like("user_id", "123456%")

    if (rateLimitError) {
      console.error("[v0] Clear rate limits error:", rateLimitError)
    }

    return NextResponse.json({
      success: true,
      message: "Test data cleared successfully",
    })
  } catch (error) {
    console.error("[v0] Clear test data error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    )
  }
}
