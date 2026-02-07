import { createClient } from "@/lib/supabase/server"

export interface LeaderboardPlayer {
  userId: string
  username: string
  firstName: string
  totalScore: number
  chaptersCompleted: number
  themesCompleted: number
  rank: number
}

export interface UserRank {
  rank: number
  totalPlayers: number
}

export interface LeaderboardStats {
  totalPlayers: number
  averageChapters: number
  topScore: number
  completionRate: number
}

export interface UserStats {
  userId: string
  totalPp: number
  chaptersCompleted: number
  themesCompleted: number
  rank: number
  totalPlayers: number
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  firstName: string
  chaptersCompleted: number
  themesCompleted: number
  totalScore: number
  lastActive?: string
}

/**
 * LeaderboardManager - Centralized leaderboard logic
 *
 * RANKING ALGORITHM (PP-FIRST):
 * 1. total_pp DESC (PRIMARY metric)
 * 2. themes_completed DESC (secondary tie-breaker)
 * 3. chapters_completed DESC (tertiary tie-breaker)
 *
 * Only users with total_pp > 0 are included in rankings.
 * Users with 0 PP will have rank = 0 (not ranked).
 */
export class LeaderboardManager {
  /**
   * Get top N players from the leaderboard
   * Uses RPC: get_leaderboard (PP-first algorithm)
   */
  static async getTopPlayers(limit = 100): Promise<LeaderboardPlayer[]> {
    const supabase = await createClient()

    try {
      const { data, error } = await supabase.rpc("get_leaderboard", {
        limit_count: limit,
      })

      if (error) {
        console.error("[LeaderboardManager] Error fetching top players:", error)
        throw error
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return []
      }

      return data.map((player: any) => ({
        userId: player.user_id,
        username: player.username || player.first_name || "Anonymous",
        firstName: player.first_name || "Anonymous",
        totalScore: player.total_pp || 0, // PP is the primary score
        chaptersCompleted: player.total_chapters_completed || 0,
        themesCompleted: player.themes_completed || 0,
        rank: Number(player.current_rank),
      }))
    } catch (error) {
      console.error("[LeaderboardManager] Failed to get top players:", error)
      throw error
    }
  }

  /**
   * Get a specific user's rank
   * Uses RPC: get_user_rank (PP-first algorithm)
   * Returns rank = 0 if user has no PP
   */
  static async getUserRank(userId: string): Promise<UserRank | null> {
    const supabase = await createClient()

    try {
      const { data, error } = await supabase.rpc("get_user_rank", {
        p_user_id: userId,
      })

      if (error) {
        console.error("[LeaderboardManager] Error fetching user rank:", error)
        throw error
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return null
      }

      const rankData = data[0]
      if (!rankData) return null

      return {
        rank: Number(rankData.rank) || 0,
        totalPlayers: Number(rankData.total_players) || 0,
      }
    } catch (error) {
      console.error("[LeaderboardManager] Failed to get user rank:", error)
      return null
    }
  }

  /**
   * Get comprehensive user statistics including rank and progress
   * Combines data from user_progress table and get_user_rank RPC
   */
  static async getUserStats(userId: string): Promise<UserStats | null> {
    const supabase = await createClient()

    try {
      // Fetch user progress data
      const { data: progressData, error: progressError } = await supabase
        .from("user_progress")
        .select("total_pp, chapters_completed, themes_completed")
        .eq("user_id", userId)
        .single()

      if (progressError) {
        console.error("[LeaderboardManager] Error fetching user progress:", progressError)
        return null
      }

      // Fetch user rank
      const rankData = await this.getUserRank(userId)

      return {
        userId,
        totalPp: progressData?.total_pp || 0,
        chaptersCompleted: progressData?.chapters_completed || 0,
        themesCompleted: progressData?.themes_completed || 0,
        rank: rankData?.rank || 0,
        totalPlayers: rankData?.totalPlayers || 0,
      }
    } catch (error) {
      console.error("[LeaderboardManager] Failed to get user stats:", error)
      return null
    }
  }

  /**
   * Get global leaderboard statistics
   * Uses RPC: get_leaderboard_stats (PP as top_score)
   */
  static async getLeaderboardStats(): Promise<LeaderboardStats> {
    const supabase = await createClient()

    try {
      const { data, error } = await supabase.rpc("get_leaderboard_stats")

      if (error) {
        console.error("[LeaderboardManager] Error fetching stats:", error)
        throw error
      }

      if (!data || data.length === 0) {
        return {
          totalPlayers: 0,
          averageChapters: 0,
          topScore: 0,
          completionRate: 0,
        }
      }

      const stats = data[0]

      return {
        totalPlayers: Number(stats.total_players) || 0,
        averageChapters: Number(stats.avg_chapters) || 0,
        topScore: Number(stats.top_score) || 0, // Now returns max total_pp
        completionRate: Number(stats.completion_rate) || 0,
      }
    } catch (error) {
      console.error("[LeaderboardManager] Failed to get stats:", error)
      return {
        totalPlayers: 0,
        averageChapters: 0,
        topScore: 0,
        completionRate: 0,
      }
    }
  }

  /**
   * Format leaderboard data for Telegram message
   */
  static formatLeaderboardMessage(
    players: LeaderboardPlayer[],
    userRank?: { rank: number; totalPlayers: number },
  ): string {
    if (players.length === 0) {
      return "🏆 <b>Classifica King of Carts</b>\n\nNessun giocatore trovato. Sii il primo a completare una storia! ✨"
    }

    let message = "🏆 <b>Classifica King of Carts</b>\n\n"

    // Add top players
    players.slice(0, 10).forEach((player, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`
      const name = player.firstName.length > 15 ? player.firstName.substring(0, 15) + "..." : player.firstName

      message += `${medal} <b>${name}</b>\n`
      message += `   ⭐ <b>${player.totalScore} PP</b> • 📚 ${player.chaptersCompleted} capitoli\n\n`
    })

    // Add user's rank if provided
    if (userRank && userRank.rank > 0) {
      message += `📊 <b>La Tua Posizione:</b> #${userRank.rank} su ${userRank.totalPlayers}\n\n`
    } else if (userRank) {
      message += `📊 <b>La Tua Posizione:</b> Non classificato (gioca per entrare in classifica!)\n\n`
    }

    message += "<i>Classifica basata sui PP (Power Points) 🌟</i>\n"
    message += "<i>Completa capitoli per guadagnare PP e scalare la classifica!</i>"

    return message
  }
}
