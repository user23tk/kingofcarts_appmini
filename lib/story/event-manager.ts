import { getAdminClient } from "@/lib/supabase/admin-singleton"

export class EventManager {
  /**
   * Get the currently active event contest (with expiration check)
   * Uses get_event_for_leaderboard which supports 7-day post-event visibility
   */
  static async getActiveEvent() {
    const supabase = getAdminClient()

    await supabase.rpc("deactivate_expired_events")

    // and supports 7-day post-event visibility window
    const { data, error } = await supabase.rpc("get_event_for_leaderboard")

    if (error) {
      console.error("[EventManager] Error getting active event:", error)
      return null
    }

    return data || null
  }

  /**
   * Check if a theme is an event contest
   */
  static async isEventTheme(themeKey: string): Promise<boolean> {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("themes")
      .select("is_event, is_active, event_end_date")
      .eq("name", themeKey)
      .single()

    if (error || !data) {
      console.error("[v0] Error checking if theme is event:", error)
      return false
    }

    // Check if event is active and not expired
    const isActive = data.is_event && data.is_active
    const isNotExpired = !data.event_end_date || new Date(data.event_end_date) > new Date()

    return isActive && isNotExpired
  }

  /**
   * Get event leaderboard for a specific event
   */
  static async getEventLeaderboard(themeKey: string, limit = 100) {
    const supabase = getAdminClient()
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
    const supabase = getAdminClient()
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
   * Get PP multiplier for a theme (returns 1.0 if not an event)
   */
  static async getPPMultiplier(themeKey: string): Promise<number> {
    const supabase = getAdminClient()
    const { data: theme } = await supabase
      .from("themes")
      .select("pp_multiplier, is_event, is_active, event_end_date")
      .eq("name", themeKey)
      .single()

    if (!theme || !theme.is_event || !theme.is_active) {
      return 1.0
    }

    if (theme.event_end_date && new Date(theme.event_end_date) <= new Date()) {
      return 1.0
    }

    return theme.pp_multiplier || 1.0
  }

  /**
   * Update event leaderboard when user completes a chapter in an event
   * Uses atomic transaction to prevent race conditions
   *
   * Added detailed logging and error handling for debugging
   */
  static async updateEventLeaderboard(userId: string, themeKey: string, ppGained: number): Promise<void> {
    const supabase = getAdminClient()

    // Check if theme is an active event
    const isEvent = await this.isEventTheme(themeKey)
    if (!isEvent) {
      console.log("[v0] Theme is not an active event, skipping event leaderboard update")
      return
    }

    console.log(`[v0] [EVENT] Updating event leaderboard: user=${userId}, theme=${themeKey}, pp=${ppGained}`)

    const { error } = await supabase.rpc("update_event_leaderboard_atomic", {
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
      // Don't throw - we want to log but not break the main flow
    } else {
      console.log(`[v0] [EVENT] Successfully updated event leaderboard for theme ${themeKey}`)

      // Verify the update
      const { data: verifyData, error: verifyError } = await supabase
        .from("event_leaderboard")
        .select("total_pp, chapters_completed")
        .eq("user_id", userId)
        .eq("theme", themeKey)
        .single()

      if (verifyError) {
        console.warn(`[v0] [EVENT] Could not verify event leaderboard update:`, verifyError)
      } else {
        console.log(
          `[v0] [EVENT] Verified: user ${userId} now has ${verifyData?.total_pp} PP, ${verifyData?.chapters_completed} chapters in event ${themeKey}`,
        )
      }
    }
  }
}
