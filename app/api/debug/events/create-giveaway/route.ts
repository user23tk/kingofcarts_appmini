import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
    const auth = await requireDebugAuth(request)
    if (!auth.authorized) return auth.response

    try {
        const body = await request.json()
        const { theme_id, prize_title, top_n } = body

        if (!theme_id || !prize_title) {
            return NextResponse.json({ error: "Missing required fields: theme_id, prize_title" }, { status: 400 })
        }

        const supabase = await createClient()

        const { data, error } = await supabase.rpc("create_event_giveaway", {
            p_theme_id: theme_id,
            p_prize_title: prize_title,
            p_top_n: top_n || 10
        })

        if (error) {
            logger.error("debug-events", "Error creating giveaway from event", { error })
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!data.success) {
            return NextResponse.json({ error: data.error }, { status: 400 })
        }

        logger.info("debug-events", "Giveaway created from event", { theme_id, giveaway_id: data.giveaway_id })
        return NextResponse.json({ success: true, ...data })

    } catch (error) {
        logger.error("debug-events", "Error in create-giveaway endpoint", { error })
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
