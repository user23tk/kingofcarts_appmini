import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function DELETE(request: NextRequest) {
  try {
    const authError = await requireDebugAuth(request)
    if (authError) {
      return authError
    }

    const { searchParams } = new URL(request.url)
    const giveawayId = searchParams.get("id")

    if (!giveawayId) {
      return NextResponse.json({ error: "Missing giveaway ID" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Delete related entries first
    const { error: entriesError } = await supabase.from("giveaway_entries").delete().eq("giveaway_id", giveawayId)

    if (entriesError) {
      console.error("[giveaway-delete] Error deleting entries:", entriesError)
    }

    // Delete related results
    const { error: resultsError } = await supabase.from("giveaway_results").delete().eq("giveaway_id", giveawayId)

    if (resultsError) {
      console.error("[giveaway-delete] Error deleting results:", resultsError)
    }

    // Delete the giveaway itself
    const { data, error: giveawayError } = await supabase.from("giveaways").delete().eq("id", giveawayId).select()

    if (giveawayError) {
      console.error("[giveaway-delete] Error deleting giveaway:", giveawayError)
      return NextResponse.json({ error: "Failed to delete giveaway", details: giveawayError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Giveaway deleted successfully",
      deleted_id: giveawayId,
      deleted_data: data,
    })
  } catch (error) {
    console.error("[giveaway-delete] Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
