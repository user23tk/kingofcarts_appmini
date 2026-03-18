import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    const { eventId, isActive } = body

    if (!eventId) {
      return NextResponse.json({ error: "Event ID richiesto" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // If activating, check if there's already an active event
    if (isActive) {
      const { data: activeEvents } = await supabase
        .from("themes")
        .select("id")
        .eq("is_event", true)
        .eq("is_active", true)
        .neq("id", eventId)

      if (activeEvents && activeEvents.length > 0) {
        return NextResponse.json(
          { error: "Esiste già un evento attivo. Disattivalo prima di attivarne un altro." },
          { status: 400 },
        )
      }
    }

    // Toggle event status
    const { error } = await supabase.from("themes").update({ is_active: isActive }).eq("id", eventId)

    if (error) {
      logger.error("debug-events-toggle", "Error toggling event", { error, eventId, isActive })
      return NextResponse.json({ error: "Errore nell'aggiornamento dell'evento" }, { status: 500 })
    }

    logger.info("debug-events-toggle", "Event toggled successfully", { eventId, isActive })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("debug-events-toggle", "Error in events toggle", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
