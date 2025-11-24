import { createClient } from "@/lib/supabase/server"
import { EventManager } from "@/lib/story/event-manager"

export interface EventLeaderboardEntry {
  userId: string
  username: string
  firstName: string
  totalPp: number
  chaptersCompleted: number
  rank: number
  lastUpdated: string
}

export interface UserEventStats {
  userId: string
  theme: string
  totalPp: number
  chaptersCompleted: number
  rank: number
  totalParticipants: number
  lastUpdated: string
}

/**
 * EventLeaderboardManager - Manages event-specific leaderboards with PP-first ranking
 *
 * KEY CONCEPTS:
 * - Event PP are PART OF total PP (not separate)
 * - Events have multipliers that boost PP gains
 * - Ranking is PP-first: total_pp DESC, chapters_completed DESC, created_at ASC
 * - Only users with PP > 0 are ranked
 *
 * ALGORITHM:
 * 1. ORDER BY total_pp DESC (primary)
 * 2. THEN chapters_completed DESC (tie-breaker)
 * 3. THEN created_at ASC (earlier player wins on exact tie)
 */
export class EventLeaderboardManager {
  /**
   * Get event leaderboard with PP-first ranking
   * Uses RPC: get_event_leaderboard_v2
   */
  static async getEventLeaderboard(theme: string, limit = 100): Promise<EventLeaderboardEntry[]> {
    const supabase = await createClient()

    try {
      const { data, error } = await supabase.rpc("get_event_leaderboard_v2", {
        p_theme: theme,
        p_limit: limit,
      })

      if (error) {
        console.error("[EventLeaderboardManager] Error fetching event leaderboard:", error)
        throw error
      }

      if (!data || data.length === 0) {
        return []
      }

      return data.map((entry: any) => ({
        userId: entry.user_id,
        username: entry.username || entry.first_name || "Anonymous",
        firstName: entry.first_name || "Anonymous",
        totalPp: entry.total_pp || 0,
        chaptersCompleted: entry.chapters_completed || 0,
        rank: Number(entry.rank),
        lastUpdated: entry.last_updated,
      }))
    } catch (error) {
      console.error("[EventLeaderboardManager] Failed to get event leaderboard:", error)
      throw error
    }
  }

  /**
   * Get user's stats and rank for a specific event
   * Uses RPC: get_user_event_stats
   */
  static async getUserEventStats(userId: string, theme: string): Promise<UserEventStats | null> {
    const supabase = await createClient()

    try {
      const { data, error } = await supabase.rpc("get_user_event_stats", {
        p_user_id: userId,
        p_theme: theme,
      })

      if (error) {
        console.error("[EventLeaderboardManager] Error fetching user event stats:", error)
        throw error
      }

      if (!data || data.length === 0) {
        return null
      }

      const stats = data[0]

      return {
        userId: stats.user_id,
        theme: stats.theme,
        totalPp: stats.total_pp || 0,
        chaptersCompleted: stats.chapters_completed || 0,
        rank: Number(stats.rank) || 0,
        totalParticipants: Number(stats.total_participants) || 0,
        lastUpdated: stats.last_updated,
      }
    } catch (error) {
      console.error("[EventLeaderboardManager] Failed to get user event stats:", error)
      return null
    }
  }

  /**
   * Update event progress for a user
   * Uses RPC: update_event_progress_v2
   *
   * NOTE: This updates ONLY the event_leaderboard table.
   * Total PP updates are handled separately in the story completion flow.
   */
  static async updateEventProgress(
    userId: string,
    theme: string,
    ppGained: number,
    chaptersIncrement = 1,
  ): Promise<UserEventStats | null> {
    const supabase = await createClient()

    try {
      const { data, error } = await supabase.rpc("update_event_progress_v2", {
        p_user_id: userId,
        p_theme: theme,
        p_pp_gained: ppGained,
        p_chapters_increment: chaptersIncrement,
      })

      if (error) {
        console.error("[EventLeaderboardManager] Error updating event progress:", error)
        throw error
      }

      if (!data || data.length === 0) {
        return null
      }

      const stats = data[0]

      return {
        userId: stats.user_id,
        theme: stats.theme,
        totalPp: stats.total_pp || 0,
        chaptersCompleted: stats.chapters_completed || 0,
        rank: Number(stats.rank) || 0,
        totalParticipants: 0, // Not returned by update function
        lastUpdated: new Date().toISOString(),
      }
    } catch (error) {
      console.error("[EventLeaderboardManager] Failed to update event progress:", error)
      return null
    }
  }

  /**
   * Check if a theme is an active event
   */
  static async isActiveEvent(theme: string): Promise<boolean> {
    try {
      const activeEvent = await EventManager.getActiveEvent()
      return activeEvent !== null && activeEvent.name === theme
    } catch (error) {
      console.error("[EventLeaderboardManager] Failed to check active event:", error)
      return false
    }
  }

  /**
   * Get active event details
   */
  static async getActiveEvent() {
    return EventManager.getActiveEvent()
  }

  /**
   * Format event leaderboard for display with context
   */
  static formatEventMessage(
    eventName: string,
    eventEmoji: string,
    ppMultiplier: number,
    players: EventLeaderboardEntry[],
    userStats?: UserEventStats,
  ): string {
    if (players.length === 0) {
      return `${eventEmoji} <b>${eventName}</b>\n\nNessun partecipante ancora. Sii il primo! 🌟`
    }

    let message = `${eventEmoji} <b>${eventName}</b>\n`
    message += `⚡ Moltiplicatore PP: ${ppMultiplier}x\n\n`
    message += `🏆 <b>Classifica Contest:</b>\n\n`

    // Add top players
    players.slice(0, 10).forEach((player, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`
      const name = player.firstName.length > 15 ? player.firstName.substring(0, 15) + "..." : player.firstName

      message += `${medal} <b>${name}</b>\n`
      message += `   ⭐ ${player.totalPp} PP • 📚 ${player.chaptersCompleted} cap.\n\n`
    })

    // Add user's rank if provided
    if (userStats && userStats.rank > 0) {
      message += `📊 <b>La Tua Posizione:</b> #${userStats.rank} su ${userStats.totalParticipants}\n`
      message += `⭐ <b>I Tuoi PP Contest:</b> ${userStats.totalPp}\n\n`
    }

    message += "<i>I PP del contest vengono aggiunti ai tuoi PP totali!</i>"

    return message
  }
}
