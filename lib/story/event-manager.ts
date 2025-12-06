import { createAdminClient } from "@/lib/supabase/admin"

/** Rappresenta un evento/contest attivo */
export interface ActiveEvent {
  id: string
  name: string
  title: string
  description?: string
  event_start_date?: string
  event_end_date?: string
  pp_multiplier: number
  is_active: boolean
  is_event: boolean
  event_emoji?: string
  emoji?: string
}

/** Player nella classifica evento */
export interface EventPlayer {
  rank: number
  user_id: string
  first_name: string
  total_pp: number
  chapters_completed: number
  last_updated?: string
}

/** Statistiche utente per un evento */
export interface UserEventStats {
  rank: number
  total_pp: number
  chapters_completed: number
}

export class EventManager {

  /**
   * Ottiene l'evento/contest attualmente attivo
   * Usa RPC get_active_event con fallback a query diretta
   */
  static async getActiveEvent(): Promise<ActiveEvent | null> {
    const supabase = createAdminClient()

    // Prima prova con RPC
    const { data, error } = await supabase.rpc("get_active_event")

    // Fallback a query diretta se RPC ritorna vuoto
    if (!error && (!data || (Array.isArray(data) && data.length === 0))) {
      console.log("RPC vuoto, fallback a query diretta")
      return this.getActiveEventFallback(supabase)
    }

    if (error) {
      console.error("Errore RPC get_active_event", error)
      return null
    }

    if (!data) return null

    // Gestisce risposta array (RPC ritorna TABLE)
    const event = Array.isArray(data) ? data[0] : data
    if (!event) return null

    return this.normalizeEventResponse(event)
  }

  /**
   * Fallback query diretta quando RPC non funziona
   */
  private static async getActiveEventFallback(supabase: ReturnType<typeof createAdminClient>): Promise<ActiveEvent | null> {
    const { data, error } = await supabase
      .from("themes")
      .select("name, title, description, event_start_date, event_end_date, pp_multiplier, is_event, is_active, event_emoji, emoji")
      .eq("is_event", true)
      .eq("is_active", true)
      .order("event_start_date", { ascending: false })
      .limit(1)

    if (error || !data?.length) return null

    const theme = data[0]
    const now = new Date()
    const isWithinTimeWindow =
      (!theme.event_start_date || new Date(theme.event_start_date) <= now) &&
      (!theme.event_end_date || new Date(theme.event_end_date) > now)

    if (!isWithinTimeWindow) return null

    return {
      id: theme.name,
      name: theme.name,
      title: theme.title,
      description: theme.description,
      event_start_date: theme.event_start_date,
      event_end_date: theme.event_end_date,
      pp_multiplier: theme.pp_multiplier || 1.0,
      is_active: true,
      is_event: true,
      event_emoji: theme.event_emoji || theme.emoji,
      emoji: theme.emoji || theme.event_emoji,
    }
  }

  /**
   * Normalizza la risposta RPC che può avere formati diversi
   */
  private static normalizeEventResponse(event: Record<string, unknown>): ActiveEvent {
    // Supporta entrambi i formati: vecchio (name/title) e nuovo (theme_id/theme_name)
    // PREFERIRE SEMPRE 'name' se disponibile perché è la chiave canonica (es. "natale")
    const themeId = (event.name || event.theme_id) as string
    const themeName = (event.title || event.theme_name) as string
    const themeDesc = (event.description || event.theme_description) as string | undefined
    const startDate = (event.event_start_date || event.start_date) as string | undefined
    const endDate = (event.event_end_date || event.end_date) as string | undefined

    console.log("Evento attivo trovato:", themeId)

    return {
      id: themeId,
      name: themeId,
      title: themeName,
      description: themeDesc,
      event_start_date: startDate,
      event_end_date: endDate,
      pp_multiplier: parseFloat(String(event.pp_multiplier)) || 1.0,
      is_active: true,
      is_event: true,
      event_emoji: (event.event_emoji || event.emoji) as string,
      emoji: (event.emoji || event.event_emoji) as string
    }
  }

  /**
   * Verifica se un tema è un contest evento attivo
   */
  static async isEventTheme(themeKey: string): Promise<boolean> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("themes")
      .select("is_event, is_active, event_start_date, event_end_date")
      .ilike("name", themeKey)
      .single()

    if (error || !data || !data.is_event || !data.is_active) {
      return false
    }

    const now = new Date()
    const hasStarted = !data.event_start_date || new Date(data.event_start_date) <= now
    const hasNotEnded = !data.event_end_date || new Date(data.event_end_date) > now

    return hasStarted && hasNotEnded
  }

  /**
   * Ottiene la classifica dell'evento
   */
  static async getEventLeaderboard(themeKey: string, limit = 100): Promise<EventPlayer[]> {
    const supabase = createAdminClient()

    // 1. Fetch canonical theme name to ensure we query the correct leaderboard
    const { data: themeData } = await supabase
      .from("themes")
      .select("name")
      .ilike("name", themeKey)
      .single()

    const canonicalName = themeData?.name || themeKey
    console.log(`[EventManager] Fetching leaderboard for: '${canonicalName}' (input: '${themeKey}')`)

    // Use direct query as requested by user to ensure data consistency
    // This bypasses the RPC which was returning incorrect data
    const { data: directData, error: directError } = await supabase
      .from("event_leaderboard")
      .select(`
        total_pp,
        chapters_completed,
        last_updated,
        user_id,
        users (
          first_name
        )
      `)
      .eq("theme", canonicalName)
      .order("total_pp", { ascending: false })
      .limit(limit)

    if (directError) {
      console.error("Errore query diretta leaderboard", directError)
      return []
    }

    // Map direct query result to EventPlayer interface
    const mappedData: EventPlayer[] = directData.map((row: any, index: number) => ({
      rank: index + 1,
      user_id: row.user_id,
      first_name: row.users?.first_name || "Anonymous",
      total_pp: row.total_pp,
      chapters_completed: row.chapters_completed,
      last_updated: row.last_updated
    }))

    console.log(`Leaderboard caricata (Direct): ${mappedData.length} giocatori`)
    return mappedData
  }

  /**
   * Ottiene la posizione dell'utente nella classifica evento
   */
  static async getUserEventRank(userId: string, themeKey: string): Promise<UserEventStats | null> {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc("get_user_event_stats", {
      p_user_id: userId,
      p_theme: themeKey,
    })

    if (error) {
      console.error("Errore get_user_event_stats", error)
      return null
    }

    return data
  }

  /**
   * Ottiene il moltiplicatore PP per un tema (1.0 se non è evento attivo)
   */
  static async getPPMultiplier(themeKey: string): Promise<number> {
    const isEvent = await this.isEventTheme(themeKey)
    if (!isEvent) return 1.0

    const supabase = createAdminClient()
    const { data } = await supabase
      .from("themes")
      .select("pp_multiplier")
      .eq("name", themeKey)
      .single()

    return data?.pp_multiplier || 1.0
  }

  /**
   * Aggiorna la classifica evento quando un utente completa un capitolo
   * Usa transazione atomica per prevenire race conditions
   */
  static async updateEventLeaderboard(userId: string, themeKey: string, ppGained: number): Promise<void> {
    const supabase = createAdminClient()

    // 1. Fetch canonical theme name and verify it's an active event
    console.log(`[EventManager] Checking if theme '${themeKey}' is active event...`)

    const { data: themeData, error: themeError } = await supabase
      .from("themes")
      .select("name, is_event, is_active, event_start_date, event_end_date")
      .ilike("name", themeKey)
      .single()

    if (themeError || !themeData) {
      console.log(`[EventManager] Theme '${themeKey}' not found or error:`, themeError)
      return
    }

    const now = new Date()
    const hasStarted = !themeData.event_start_date || new Date(themeData.event_start_date) <= now
    const hasNotEnded = !themeData.event_end_date || new Date(themeData.event_end_date) > now
    const isEvent = themeData.is_event && themeData.is_active && hasStarted && hasNotEnded

    console.log(`[EventManager] Theme '${themeData.name}' (input: ${themeKey}) is active event: ${isEvent}`)

    if (!isEvent) {
      console.log(`Tema ${themeData.name} non è evento attivo, skip update`)
      return
    }

    // 2. Use the CANONICAL name from the database
    // This ensures that if the DB has "natale" and we pass "Natale", we use "natale"
    const canonicalThemeName = themeData.name

    console.log(`[EventManager] Updating leaderboard for canonical theme: '${canonicalThemeName}' (input was '${themeKey}')`)

    const { error } = await supabase.rpc("update_event_leaderboard_atomic", {
      p_user_id: userId,
      p_theme: canonicalThemeName,
      p_pp_gained: ppGained,
    })

    if (error) {
      console.error("Errore update_event_leaderboard_atomic", error)
      throw new Error(`Failed to update event leaderboard: ${error.message}`)
    }

    console.log(`Leaderboard aggiornata: user=${userId}, theme=${canonicalThemeName}, pp=${ppGained}`)
  }
}
