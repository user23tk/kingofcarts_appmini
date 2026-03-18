import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

// GET - Fetch all events and active event (public endpoint)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()

    const { data: events, error: eventsError } = await supabase
      .from("themes")
      .select("*")
      .eq("is_event", true)
      .order("created_at", { ascending: false })

    if (eventsError) {
      logger.error("debug-events", "Error fetching events", { error: eventsError })
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
    }

    const { data: activeEvent } = await supabase.rpc("get_active_event")

    return NextResponse.json({
      events: events || [],
      activeEvent: activeEvent && activeEvent.length > 0 ? activeEvent[0] : null,
    })
  } catch (error) {
    logger.error("debug-events", "Error in events GET", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create new event
export async function POST(request: NextRequest) {
  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    const { name, title, description, event_emoji, pp_multiplier, event_end_date, is_active } = body

    // Validation
    if (!name || !title) {
      return NextResponse.json({ error: "Nome e titolo sono obbligatori" }, { status: 400 })
    }

    if (pp_multiplier < 1 || pp_multiplier > 5) {
      return NextResponse.json({ error: "Il moltiplicatore PP deve essere tra 1 e 5" }, { status: 400 })
    }

    // Validate event_end_date
    if (event_end_date) {
      const endDate = new Date(event_end_date)
      const now = new Date()

      if (isNaN(endDate.getTime())) {
        return NextResponse.json({ error: "Data di fine non valida" }, { status: 400 })
      }

      if (endDate <= now) {
        return NextResponse.json({ error: "La data di fine deve essere nel futuro" }, { status: 400 })
      }

      const oneYearFromNow = new Date()
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
      if (endDate > oneYearFromNow) {
        return NextResponse.json({ error: "La data di fine non può essere oltre 1 anno nel futuro" }, { status: 400 })
      }
    }

    const supabase = createAdminClient()

    // Check if there's already an active event
    if (is_active) {
      const { data: activeEvents } = await supabase
        .from("themes")
        .select("id")
        .eq("is_event", true)
        .eq("is_active", true)

      if (activeEvents && activeEvents.length > 0) {
        return NextResponse.json(
          { error: "Esiste già un evento attivo. Disattivalo prima di attivarne un altro." },
          { status: 400 },
        )
      }
    }

    // Create event theme
    const { data: theme, error: themeError } = await supabase
      .from("themes")
      .insert({
        name,
        title: title || name,
        description: description || title || "",
        event_emoji: event_emoji || "🎃",
        is_event: true,
        pp_multiplier: pp_multiplier || 1.5,
        event_start_date: new Date().toISOString(),
        event_end_date: event_end_date || null,
        is_active: is_active || false,
      })
      .select()
      .single()

    if (themeError) {
      logger.error("debug-events", "Error creating event", { error: themeError })
      return NextResponse.json(
        {
          error: "Errore nella creazione dell'evento",
          details: themeError.message,
        },
        { status: 500 },
      )
    }

    logger.info("debug-events", "Event created successfully", { eventId: theme.id, name })
    return NextResponse.json({ success: true, event: theme })
  } catch (error) {
    logger.error("debug-events", "Error in events POST", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete event
export async function DELETE(request: NextRequest) {
  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json({ error: "Event ID richiesto" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Soft delete - just mark as inactive
    const { error } = await supabase.from("themes").update({ is_active: false }).eq("id", eventId)

    if (error) {
      logger.error("debug-events", "Error deleting event", { error, eventId })
      return NextResponse.json({ error: "Errore nell'eliminazione dell'evento" }, { status: 500 })
    }

    logger.warn("debug-events", "Event deleted (deactivated)", { eventId })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("debug-events", "Error in events DELETE", { error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
