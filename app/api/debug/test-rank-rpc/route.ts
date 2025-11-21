import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: rankData, error: rankError } = await supabase.rpc("get_user_rank", {
      p_user_id: userId,
    })

    if (rankError) {
      return NextResponse.json({ error: rankError.message, details: rankError }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      rank: rankData?.[0]?.rank || 0,
      total_players: rankData?.[0]?.total_players || 0,
      raw_data: rankData,
    })
  } catch (error) {
    console.error("[v0] Test rank RPC error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
