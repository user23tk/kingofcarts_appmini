import { createAdminClient } from "@/lib/supabase/admin"

export class EventManager {
  /**
   * Get the currently active event contest (with expiration check)
   * Uses the consolidated get_active_event RPC with fallback to direct query
   */
  static async getActiveEvent() {
    const supabase = createAdminClient()

    console.log("[EventManager] getActiveEvent called")

    // NOTA: deactivate_expired_events rimossa - la logica di scadenza 
    // è già gestita nel WHERE della funzione get_active_event()

    // Get the active event using consolidated RPC
    const { data, error } = await supabase.rpc("get_active_event")

    console.log("[EventManager] RPC get_active_event RAW response:", { 
      data: JSON.stringify(data), 
      error: error ? JSON.stringify(error) : null,
      dataType: typeof data,
      isArray: Array.isArray(data),
      dataLength: Array.isArray(data) ? data.length : 'N/A'
    })

    // Se non c'è errore ma data è vuoto/null, prova query diretta
    if (!error && (!data || (Array.isArray(data) && data.length === 0))) {
      console.log("[EventManager] RPC returned empty, trying direct query...")
      const { data: directData, error: directError } = await supabase
        .from("themes")
        .select("name, title, description, event_start_date, event_end_date, pp_multiplier, is_event, is_active")
        .eq("is_event", true)
        .eq("is_active", true)
        .order("event_start_date", { ascending: false })
        .limit(1)
      
      console.log("[EventManager] Direct query result:", {
        data: JSON.stringify(directData),
        error: directError ? JSON.stringify(directError) : null
      })
      
      if (directData && directData.length > 0) {
        const theme = directData[0]
        const now = new Date()
        const startOk = !theme.event_start_date || new Date(theme.event_start_date) <= now
        const endOk = !theme.event_end_date || new Date(theme.event_end_date) > now
        
        console.log("[EventManager] Direct query found:", {
          name: theme.name,
          startOk,
          endOk,
          event_start_date: theme.event_start_date,
          event_end_date: theme.event_end_date,
          now: now.toISOString()
        })
        
        if (startOk && endOk) {
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
          }
        }
      }
    }

    if (error) {
      console.error("[EventManager] Error getting active event:", error)
      return null
    }

    if (!data) {
      console.log("[EventManager] No data returned from RPC")
      return null
    }

    // Handle array response (RPC returns TABLE)
    if (Array.isArray(data) && data.length > 0) {
      console.log("[EventManager] Active event found:", data[0].theme_id)
      return {
        id: data[0].theme_id,
        name: data[0].theme_id,
        title: data[0].theme_name,
        description: data[0].theme_description,
        event_start_date: data[0].start_date,
        event_end_date: data[0].end_date,
        pp_multiplier: parseFloat(data[0].pp_multiplier) || 1.0,
        is_active: true,
        is_event: true,
      }
    }

    if (Array.isArray(data) && data.length === 0) {
      console.log("[EventManager] No active event (empty array)")
      return null
    }

    // If data is a single object (shouldn't happen with TABLE return type, but handle it)
    if (!Array.isArray(data) && typeof data === "object") {
      console.log("[EventManager] Single event object:", data)
      return {
        id: data.theme_id,
        name: data.theme_id,
        title: data.theme_name,
        description: data.theme_description,
        event_start_date: data.start_date,
        event_end_date: data.end_date,
        pp_multiplier: parseFloat(data.pp_multiplier) || 1.0,
        is_active: true,
        is_event: true,
      }
    }

    console.log("[EventManager] Empty or invalid response")
    return null
  }

  /**
   * Check if a theme is an active event contest
   */
  static async isEventTheme(themeKey: string): Promise<boolean> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("themes")
      .select("is_event, is_active, event_start_date, event_end_date")
      .eq("name", themeKey)
      .single()

    if (error || !data) {
      console.error("[EventManager] Error checking if theme is event:", error)
      return false
    }

    // Must be marked as event and active
    if (!data.is_event || !data.is_active) {
      return false
    }

    const now = new Date()

    if (data.event_start_date && new Date(data.event_start_date) > now) {
      console.log(`[EventManager] Event ${themeKey} has not started yet (starts: ${data.event_start_date})`)
      return false
    }

    if (data.event_end_date && new Date(data.event_end_date) < now) {
      console.log(`[EventManager] Event ${themeKey} has expired (ended: ${data.event_end_date})`)
      return false
    }

    return true
  }

  /**
   * Get event leaderboard for a specific event
   */
  static async getEventLeaderboard(themeKey: string, limit = 100) {
    const supabase = createAdminClient()

    console.log(`[EventManager] getEventLeaderboard called for theme: ${themeKey}, limit: ${limit}`)

    // Try RPC first
    const { data, error } = await supabase.rpc("get_event_leaderboard_v2", {
      p_theme: themeKey,
      p_limit: limit,
    })

    if (error) {
      console.error("[EventManager] RPC get_event_leaderboard_v2 failed:", error)
      return []
    }

    console.log(`[EventManager] RPC returned ${data?.length || 0} players`)
    return data || []
  }

  /**
   * Get user's rank in event leaderboard
   */
  static async getUserEventRank(userId: string, themeKey: string) {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc("get_user_event_stats", {
      p_user_id: userId,
      p_theme: themeKey,
    })

    if (error) {
      console.error("[EventManager] Error getting user event rank:", error)
      return null
    }

    return data
  }

  /**
   * Get PP multiplier for a theme (returns 1.0 if not an active event)
   */
  static async getPPMultiplier(themeKey: string): Promise<number> {
    const supabase = createAdminClient()
    const { data: theme } = await supabase
      .from("themes")
      .select("pp_multiplier, is_event, is_active, event_start_date, event_end_date")
      .eq("name", themeKey)
      .single()

    // No theme found or not an event
    if (!theme || !theme.is_event || !theme.is_active) {
      return 1.0
    }

    const now = new Date()

    if (theme.event_start_date && new Date(theme.event_start_date) > now) {
      return 1.0
    }

    if (theme.event_end_date && new Date(theme.event_end_date) < now) {
      return 1.0
    }

    return theme.pp_multiplier || 1.0
  }

  /**
   * Update event leaderboard when user completes a chapter in an event
   * Uses atomic transaction to prevent race conditions
   */
  static async updateEventLeaderboard(userId: string, themeKey: string, ppGained: number): Promise<void> {
    const supabase = createAdminClient()

    console.log(`[EventManager] updateEventLeaderboard called:`, {
      userId,
      themeKey,
      ppGained,
    })

    // Check if theme is an active event (with time window validation)
    const isEvent = await this.isEventTheme(themeKey)
    console.log(`[EventManager] isEventTheme result for ${themeKey}:`, isEvent)

    if (!isEvent) {
      console.log(`[EventManager] Theme ${themeKey} is not an active event, skipping event leaderboard update`)
      return
    }

    console.log(
      `[EventManager] Calling update_event_leaderboard_atomic RPC: user=${userId}, theme=${themeKey}, pp=${ppGained}`,
    )

    const { error } = await supabase.rpc("update_event_leaderboard_atomic", {
      p_user_id: userId,
      p_theme: themeKey,
      p_pp_gained: ppGained,
    })

    if (error) {
      console.error("[EventManager] Error updating event leaderboard:", error)
      throw new Error(`Failed to update event leaderboard: ${error.message}`)
    }

    console.log(`[EventManager] RPC call successful for theme ${themeKey}`)

    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from("event_leaderboard")
      .select("total_pp, chapters_completed")
      .eq("user_id", userId)
      .eq("theme", themeKey)
      .single()

    if (verifyError) {
      console.error(`[EventManager] Could not verify event leaderboard update:`, verifyError)
    } else {
      console.log(
        `[EventManager] Verified: user ${userId} now has ${verifyData?.total_pp} PP, ${verifyData?.chapters_completed} chapters in event ${themeKey}`,
      )
    }
  }
}
