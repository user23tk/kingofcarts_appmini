import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

/**
 * GET /api/debug/giveaway/list
 * Lists all giveaways (admin/debug only)
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

    const { data: giveaways, error } = await supabase
      .from("giveaways")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      logger.error("debug-giveaway-list", "Query error", { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ giveaways })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("debug-giveaway-list", "Error", { error: errorMessage })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
