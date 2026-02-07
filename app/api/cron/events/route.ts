import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    // Verify Cron Secret if present in env to prevent external abuse
    // Vercel automatically sets CRON_SECRET env var and sends it in Authorization header
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        const supabase = await createClient()

        // Call RPC to deactivate expired events
        const { data: count, error } = await supabase.rpc("deactivate_expired_events")

        if (error) {
            logger.error("cron-events", "Error deactivating events", { error })
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const message = `Deactivated ${count} expired events`
        logger.info("cron-events", message, { count })

        return NextResponse.json({ success: true, message, count })
    } catch (error) {
        logger.error("cron-events", "Unexpected error", { error })
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
