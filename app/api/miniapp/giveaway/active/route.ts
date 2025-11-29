import { type NextRequest, NextResponse } from "next/server"
import { requireTelegramAuth } from "@/lib/miniapp/auth-middleware"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"
import type { GiveawayWithUserData } from "@/lib/giveaway/types"

export const dynamic = "force-dynamic"

/**
 * GET /api/miniapp/giveaway/active
 * Returns the active giveaway with user ticket data
 */
export async function POST(request: NextRequest) {
  const auth = await requireTelegramAuth(request)
  if (!auth.authorized) return auth.response

  const userId = auth.userId!

  try {
    const supabase = await createClient()

    // Call RPC to get active giveaway with user data
    const { data, error } = await supabase.rpc("get_active_giveaway_for_user", {
      p_user_id: userId,
    })

    if (error) {
      logger.error("giveaway-active", "RPC error", { error: error.message, userId })
      return NextResponse.json({ error: "Failed to fetch giveaway" }, { status: 500 })
    }

    const result = data as GiveawayWithUserData

    logger.debug("giveaway-active", "Fetched giveaway data", {
      userId,
      hasGiveaway: !!result?.giveaway,
      hasWinner: !!result?.winner,
    })

    return NextResponse.json(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("giveaway-active", "Error fetching giveaway", { error: errorMessage, userId })
    return NextResponse.json({ error: "Failed to fetch giveaway" }, { status: 500 })
  }
}
