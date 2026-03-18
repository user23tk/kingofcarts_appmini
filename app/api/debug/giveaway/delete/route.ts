import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { logger } from "@/lib/debug/logger"

export async function DELETE(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) {
    return authCheck.response!
  }

  try {
    const { searchParams } = new URL(request.url)
    const giveawayId = searchParams.get("id")

    if (!giveawayId) {
      return NextResponse.json({ error: "Missing giveaway ID" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // First, delete related entries and results
    const { error: entriesError } = await supabase.from("giveaway_entries").delete().eq("giveaway_id", giveawayId)

    if (entriesError) {
      logger.warn("giveaway-delete", "Error deleting entries", { error: entriesError.message, giveawayId })
    }

    const { error: resultsError } = await supabase.from("giveaway_results").delete().eq("giveaway_id", giveawayId)

    if (resultsError) {
      logger.warn("giveaway-delete", "Error deleting results", { error: resultsError.message, giveawayId })
    }

    // Then delete the giveaway itself
    const { error: giveawayError } = await supabase.from("giveaways").delete().eq("id", giveawayId)

    if (giveawayError) {
      logger.error("giveaway-delete", "Error deleting giveaway", { error: giveawayError.message, giveawayId })
      return NextResponse.json({ error: "Failed to delete giveaway", details: giveawayError.message }, { status: 500 })
    }

    logger.info("giveaway-delete", "Giveaway deleted successfully", { giveawayId })

    return NextResponse.json({
      success: true,
      message: "Giveaway deleted successfully",
      deleted_id: giveawayId,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error("giveaway-delete", "Unexpected error", { error: errorMessage })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
