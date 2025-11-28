import { type NextRequest, NextResponse } from "next/server"
import { requireTelegramAuth } from "@/lib/miniapp/auth-middleware"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"
import type { AllocateTicketResponse } from "@/lib/giveaway/types"

export const dynamic = "force-dynamic"

/**
 * POST /api/miniapp/giveaway/enter
 * Allocates a single ticket to the user for a giveaway
 */
export async function POST(request: NextRequest) {
  const auth = await requireTelegramAuth(request)
  if (!auth.authorized) return auth.response

  const userId = auth.userId!

  try {
    const { giveaway_id } = auth.body || {}

    if (!giveaway_id) {
      logger.warn("giveaway-enter", "Missing giveaway_id", { userId })
      return NextResponse.json({ error: "giveaway_id is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Call RPC to allocate ticket (atomic operation)
    const { data, error } = await supabase.rpc("allocate_giveaway_ticket", {
      p_giveaway_id: giveaway_id,
      p_user_id: userId,
    })

    if (error) {
      logger.error("giveaway-enter", "RPC error", { error: error.message, userId, giveaway_id })
      return NextResponse.json({ error: "Failed to allocate ticket" }, { status: 500 })
    }

    const result = data as AllocateTicketResponse

    if (!result.success) {
      logger.warn("giveaway-enter", "Ticket allocation failed", {
        userId,
        giveaway_id,
        error: result.error,
      })
      return NextResponse.json(
        {
          error: result.error || "Failed to allocate ticket",
          tickets_data: result.new_balance,
        },
        { status: 400 },
      )
    }

    logger.info("giveaway-enter", "Ticket allocated successfully", {
      userId,
      giveaway_id,
      ticket_number: result.ticket_number,
    })

    return NextResponse.json({
      success: true,
      ticket_number: result.ticket_number,
      new_balance: result.new_balance,
      message: `Ticket #${result.ticket_number} assegnato!`,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("giveaway-enter", "Error allocating ticket", { error: errorMessage, userId })
    return NextResponse.json({ error: "Failed to allocate ticket" }, { status: 500 })
  }
}
