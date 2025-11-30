import { createAdminClient } from "@/lib/supabase/admin"

export class EventManager {
  /**
   * Get the currently active event contest (with expiration check)
   * Uses the consolidated get_active_event RPC with fallback to direct query
   */
  static async getActiveEvent() {
    const supabase = createAdminClient()

    console.log("[v0] [EventManager] getActiveEvent called - using per-request client")

    // First deactivate any expired events
    const { error: deactivateError } = await supabase.rpc("deactivate_expired_events")
    if (deactivateError) {
      console.error("[v0] [EventManager] deactivate_expired_events failed:", deactivateError)
    }

    // Then get the active event using consolidated RPC
    const { data, error } = await supabase.rpc("get_active_event")

    console.info("[v0] get_active_event rows:", Array.isArray(data) ? data.length : -1)
    console.log("[v0] [EventManager] get_active_event RPC response:", {
      data,
      dataLength: data?.length,
      dataType: typeof data,
      isArray: Array.isArray(data),
      error,
    })

    if (error) {
      console.error("[v0] [EventManager] Error getting active event:", error)
      console.warn("[v0] [EventManager] RPC failed, attempting direct query fallback")
      return await this.getActiveEventDirectQuery()
    }

    // Handle different response formats
    if (!data) {
      console.log("[v0] [EventManager] No data returned from RPC")
      console.warn("[v0] [EventManager] RPC returned no data, attempting direct query fallback")
      return await this.getActiveEventDirectQuery()
    }

    // If data is array, get first element
    if (Array.isArray(data) && data.length > 0) {
      console.log("[v0] [EventManager] Returning first event from array:", data[0])
      return data[0]
    }

    if (Array.isArray(data) && data.length === 0) {
      console.warn("[v0] [EventManager] RPC returned empty array, attempting direct query fallback")
      return await this.getActiveEventDirectQuery()
    }

    // If data is a single object (not array)
    if (!Array.isArray(data) && typeof data === "object") {
      console.log("[v0] [EventManager] Returning single event object:", data)
      return data
    }

    console.log("[v0] [EventManager] Empty or invalid response, returning null")
    return null
  }

  /**
   * NEW METHOD: Direct query fallback when RPC fails
   * Bypasses RPC and queries themes table directly
   */
  private static async getActiveEventDirectQuery() {
    const supabase = createAdminClient()

    console.log("[v0] [EventManager] Executing direct query fallback")

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("themes")
      .select(
        "id, name, title, description, emoji, event_emoji, pp_multiplier, event_start_date, event_end_date, is_active",
      )
      .eq("is_event", true)
      .eq("is_active", true)
      .or(`event_start_date.is.null,event_start_date.lte.${now}`)
      .or(`event_end_date.is.null,event_end_date.gt.${now}`)
      .order("event_start_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("[v0] [EventManager] Direct query also failed:", error)
      return null
    }

    if (!data) {
      console.log("[v0] [EventManager] Direct query returned no active event")
      return null
    }

    // Additional validation for start date
    if (data.event_start_date && new Date(data.event_start_date) > new Date()) {
      console.log("[v0] [EventManager] Event not started yet:", data.name)
      return null
    }

    // Additional validation for end date
    if (data.event_end_date && new Date(data.event_end_date) <= new Date()) {
      console.log("[v0] [EventManager] Event has expired:", data.name)
      return null
    }

    console.log("[v0] [EventManager] Direct query found active event:", data.name)
    return data
  }

  /**
   * Check if a theme is an active event contest
   * BE-01: Added full time window validation (start_date and end_date)
   */
  static async isEventTheme(themeKey: string): Promise<boolean> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("themes")
      .select("is_event, is_active, event_start_date, event_end_date")
      .eq("name", themeKey)
      .single()

    if (error || !data) {
      console.error("[v0] Error checking if theme is event:", error)
      return false
    }

    // Must be marked as event and active
    if (!data.is_event || !data.is_active) {
      return false
    }

    const now = new Date()

    if (data.event_start_date && new Date(data.event_start_date) > now) {
      console.log(`[v0] Event ${themeKey} has not started yet (starts: ${data.event_start_date})`)
      return false
    }

    if (data.event_end_date && new Date(data.event_end_date) <= now) {
      console.log(`[v0] Event ${themeKey} has expired (ended: ${data.event_end_date})`)
      return false
    }

    return true
  }

  /**
   * Get event leaderboard for a specific event
   */
  static async getEventLeaderboard(themeKey: string, limit = 100) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("get_event_leaderboard_v2", {
      p_theme: themeKey,
      p_limit: limit,
    })

    if (error) {
      console.error("[v0] Error getting event leaderboard:", error)
      return []
    }

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
      console.error("[v0] Error getting user event rank:", error)
      return null
    }

    return data
  }

  /**
   * Get PP multiplier for a theme (returns 1.0 if not an active event)
   * BE-02: Added full time window validation for multiplier
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

    if (theme.event_end_date && new Date(theme.event_end_date) <= now) {
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

    console.log(`[v0] [EVENT] updateEventLeaderboard called:`, {
      userId,
      themeKey,
      ppGained,
    })

    // Check if theme is an active event (with time window validation)
    const isEvent = await this.isEventTheme(themeKey)
    console.log(`[v0] [EVENT] isEventTheme result for ${themeKey}:`, isEvent)

    if (!isEvent) {
      console.log(`[v0] [EVENT] Theme ${themeKey} is not an active event, skipping event leaderboard update`)
      return
    }

    console.log(
      `[v0] [EVENT] Calling update_event_leaderboard_atomic RPC: user=${userId}, theme=${themeKey}, pp=${ppGained}`,
    )

    const { data, error } = await supabase.rpc("update_event_leaderboard_atomic", {
      p_user_id: userId,
      p_theme: themeKey,
      p_pp_gained: ppGained,
    })

    if (error) {
      console.error("[v0] [EVENT] Error updating event leaderboard:", error)
      console.error("[v0] [EVENT] Error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      throw new Error(`Failed to update event leaderboard: ${error.message}`)
    } else {
      console.log(`[v0] [EVENT] RPC call successful for theme ${themeKey}`)

      // Verify the update
      const { data: verifyData, error: verifyError } = await supabase
        .from("event_leaderboard")
        .select("total_pp, chapters_completed")
        .eq("user_id", userId)
        .eq("theme", themeKey)
        .single()

      if (verifyError) {
        console.error(`[v0] [EVENT] Could not verify event leaderboard update:`, verifyError)
      } else {
        console.log(
          `[v0] [EVENT] Verified: user ${userId} now has ${verifyData?.total_pp} PP, ${verifyData?.chapters_completed} chapters in event ${themeKey}`,
        )
      }
    }
  }
}
