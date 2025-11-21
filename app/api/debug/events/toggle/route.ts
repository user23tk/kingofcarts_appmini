import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminKey, eventId, isActive } = body

    if (!adminKey || adminKey !== process.env.DEBUG_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!eventId) {
      return NextResponse.json({ error: "Event ID richiesto" }, { status: 400 })
    }

    const supabase = await createClient()

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
      console.error("[v0] Error toggling event:", error)
      return NextResponse.json({ error: "Errore nell'aggiornamento dell'evento" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in events toggle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
