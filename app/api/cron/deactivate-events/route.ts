import { NextResponse } from "next/server"
import { getAdminClient } from "@/lib/supabase/admin-singleton"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Cron endpoint to deactivate expired events and giveaways
 * Should be called hourly via Vercel Cron or external scheduler
 *
 * Usage:
 * - Set up a Vercel Cron job to call this endpoint hourly
 * - Or call manually via: GET /api/cron/deactivate-events?secret=YOUR_SECRET
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret (optional, for added security)
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get("secret")

    // Allow both cron headers and secret query param
    const cronSecret = request.headers.get("x-vercel-cron-secret")
    const isAuthorized =
      cronSecret === process.env.CRON_SECRET ||
      secret === process.env.CRON_SECRET ||
      process.env.CRON_SECRET === undefined // Allow if no secret configured

    if (!isAuthorized) {
      console.error("[CRON] Unauthorized cron request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getAdminClient()
    const results = {
      events_deactivated: 0,
      giveaways_deactivated: 0,
      errors: [] as string[],
    }

    // Deactivate expired events
    try {
      const { error: eventError } = await supabase.rpc("deactivate_expired_events")

      if (eventError) {
        console.error("[CRON] Error deactivating expired events:", eventError)
        results.errors.push(`Events: ${eventError.message}`)
      } else {
        // Count how many were deactivated (approximate, since RPC returns void)
        const { count } = await supabase
          .from("themes")
          .select("*", { count: "exact", head: true })
          .eq("is_event", true)
          .eq("is_active", false)

        results.events_deactivated = count || 0
        console.log(`[CRON] Deactivated expired events check complete`)
      }
    } catch (err) {
      console.error("[CRON] Exception deactivating events:", err)
      results.errors.push(`Events exception: ${err instanceof Error ? err.message : "Unknown"}`)
    }

    // Deactivate expired giveaways
    try {
      const { data: giveawayCount, error: giveawayError } = await supabase.rpc("deactivate_expired_giveaways")

      if (giveawayError) {
        console.error("[CRON] Error deactivating expired giveaways:", giveawayError)
        results.errors.push(`Giveaways: ${giveawayError.message}`)
      } else {
        results.giveaways_deactivated = giveawayCount || 0
        console.log(`[CRON] Deactivated ${giveawayCount} expired giveaways`)
      }
    } catch (err) {
      console.error("[CRON] Exception deactivating giveaways:", err)
      results.errors.push(`Giveaways exception: ${err instanceof Error ? err.message : "Unknown"}`)
    }

    console.log("[CRON] Deactivation job completed:", results)

    return NextResponse.json({
      success: results.errors.length === 0,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    console.error("[CRON] Fatal error in deactivate-events cron:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
