import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/debug/logger"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/debug/giveaway/list
 * Lists all giveaways (admin/debug only)
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  try {
    const supabase = await createClient()

    const { data: giveaways, error } = await supabase
      .from("giveaways")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        logger.warn("debug-giveaway-list", "Giveaways table not found - run migration scripts")
        return NextResponse.json({
          giveaways: [],
          warning: "Giveaways table not found. Please run the migration scripts (070, 071, 072).",
        })
      }

      logger.error("debug-giveaway-list", "Query error", { error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ giveaways: giveaways || [] })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("debug-giveaway-list", "Error", { error: errorMessage })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
