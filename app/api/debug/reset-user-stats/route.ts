import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { adminKey, userId } = await request.json()

    if (!adminKey || adminKey !== process.env.DEBUG_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    })

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single()

    if (userError || !userData) {
      console.error("[v0] User not found:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const actualUserId = userData.id

    const { error: progressError } = await supabase.from("user_progress").delete().eq("user_id", actualUserId)

    if (progressError) {
      console.error("[v0] Error resetting user progress:", progressError)
      return NextResponse.json({ error: "Failed to reset user progress" }, { status: 500 })
    }

    const { error: rateLimitError } = await supabase.from("rate_limits").delete().eq("user_id", actualUserId)

    if (rateLimitError) {
      console.error("[v0] Error resetting rate limits:", rateLimitError)
    }

    console.log(`[v0] User stats reset successfully for telegram_id: ${userId}`)
    return NextResponse.json({ success: true, message: `User statistics reset successfully for telegram_id ${userId}` })
  } catch (error) {
    console.error("[v0] Reset user stats error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
