import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

/**
 * GET /api/debug/giveaway/stats
 * Returns statistics for all giveaways (admin/debug only)
 */
export async function GET(request: NextRequest) {
  // Check debug auth
  const debugKey = request.headers.get("x-debug-key")
  const expectedKey = process.env.DEBUG_ADMIN_KEY

  if (!expectedKey || debugKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Get all giveaways
    const { data: giveaways, error: giveawaysError } = await supabase
      .from("giveaways")
      .select("*")
      .order("created_at", { ascending: false })

    if (giveawaysError) {
      logger.error("debug-giveaway-stats", "Error fetching giveaways", { error: giveawaysError.message })
      return NextResponse.json({ error: "Failed to fetch giveaways" }, { status: 500 })
    }

    // Get stats for each giveaway
    const statsPromises = giveaways.map(async (giveaway) => {
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
      total_giveaways: giveaways.length,
      active_giveaways: giveaways.filter((g) => g.is_active).length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("debug-giveaway-stats", "Error", { error: errorMessage })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
