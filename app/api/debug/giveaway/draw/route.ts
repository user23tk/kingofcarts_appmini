import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { logger } from "@/lib/debug/logger"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import type { DrawWinnerResponse } from "@/lib/giveaway/types"

export const dynamic = "force-dynamic"

/**
 * POST /api/debug/giveaway/draw
 * Draws a winner for a giveaway (admin/debug only)
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  try {
    const body = await request.json()
    const { giveaway_id, admin_user_id } = body

    if (!giveaway_id) {
      return NextResponse.json({ error: "giveaway_id is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Call RPC to draw winner
    const { data, error } = await supabase.rpc("draw_giveaway_winner", {
      p_giveaway_id: giveaway_id,
      p_admin_user_id: admin_user_id || null,
    })

    if (error) {
      logger.error("debug-giveaway-draw", "RPC error", { error: error.message, giveaway_id })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as DrawWinnerResponse

    if (!result.success) {
      logger.warn("debug-giveaway-draw", "Draw failed", { giveaway_id, error: result.error })
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    logger.info("debug-giveaway-draw", "Winner drawn successfully", {
      giveaway_id,
      winner_username: result.winner?.username,
      ticket_number: result.winner?.ticket_number,
    })

    return NextResponse.json(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("debug-giveaway-draw", "Error", { error: errorMessage })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
