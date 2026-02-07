import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
    // Verify Cron Secret
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        const supabase = await createClient()

        // Call RPC to deactivate expired giveaways
        const { data: count, error } = await supabase.rpc("deactivate_expired_giveaways")

        if (error) {
            logger.error("cron-giveaways", "Error deactivating giveaways", { error })
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const message = `Deactivated ${count} expired giveaways`
        logger.info("cron-giveaways", message, { count })

        return NextResponse.json({ success: true, message, count })
    } catch (error) {
        logger.error("cron-giveaways", "Unexpected error", { error })
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
