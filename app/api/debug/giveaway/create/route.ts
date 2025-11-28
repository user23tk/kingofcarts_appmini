import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/debug/giveaway/create
 * Creates a new giveaway (admin/debug only)
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  try {
    const body = await request.json()
    const { name, description, pp_per_ticket, prize_title, prize_description, prize_link, prize_image_url, ends_at } =
      body

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    if (!ends_at) {
      return NextResponse.json({ error: "ends_at is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("giveaways")
      .insert({
        name,
        description: description || null,
        pp_per_ticket: pp_per_ticket || 100,
        prize_title: prize_title || null,
        prize_description: prize_description || null,
        prize_type: "telegram_gift",
        prize_link: prize_link || null,
        prize_image_url: prize_image_url || null,
        starts_at: new Date().toISOString(),
        ends_at: new Date(ends_at).toISOString(),
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      logger.error("debug-giveaway-create", "Insert error", { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logger.info("debug-giveaway-create", "Giveaway created", { giveaway_id: data.id, name })

    return NextResponse.json({ success: true, giveaway: data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("debug-giveaway-create", "Error", { error: errorMessage })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
