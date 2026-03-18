import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { logger } from "@/lib/debug/logger"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/debug/giveaway/stats
 * Returns statistics for a specific giveaway or all giveaways (admin/debug only)
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  try {
    const { searchParams } = new URL(request.url)
    const giveawayId = searchParams.get("giveaway_id")

    const supabase = createAdminClient()

    if (giveawayId) {
      // Get stats for specific giveaway
      const { data: stats, error } = await supabase.rpc("get_giveaway_stats", {
        p_giveaway_id: giveawayId,
      })

      if (error) {
        logger.error("debug-giveaway-stats", "RPC error", { error: error.message })
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json(stats)
    }

    // Get all giveaways with stats
    const { data: giveaways, error: giveawaysError } = await supabase
      .from("giveaways")
      .select("*")
      .order("created_at", { ascending: false })

    if (giveawaysError) {
      logger.error("debug-giveaway-stats", "Error fetching giveaways", { error: giveawaysError.message })
      return NextResponse.json({ error: "Failed to fetch giveaways" }, { status: 500 })
    }

    // Get stats for each giveaway
    const statsPromises = (giveaways || []).map(async (giveaway) => {
      const { data: stats } = await supabase.rpc("get_giveaway_stats", {
        p_giveaway_id: giveaway.id,
      })
      return {
        ...giveaway,
        stats,
      }
    })

    const giveawaysWithStats = await Promise.all(statsPromises)

    // Get winner info for completed giveaways
    const { data: results } = await supabase.from("giveaway_results").select(`
        *,
        winner:users!winner_user_id(
          id,
          username,
          first_name,
          last_name,
          telegram_id
        )
      `)

    return NextResponse.json({
      giveaways: giveawaysWithStats,
      results: results || [],
      total_giveaways: giveaways?.length || 0,
      active_giveaways: giveaways?.filter((g) => g.is_active).length || 0,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("debug-giveaway-stats", "Error", { error: errorMessage })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
