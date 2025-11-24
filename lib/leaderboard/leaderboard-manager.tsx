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

export interface LeaderboardEntry {
  rank: number
  userId: string
  firstName: string
  chaptersCompleted: number
  themesCompleted: number
  totalScore: number
  lastActive?: string
}

export interface UserStats {
  userId: string
  totalPP: number
  themesCompleted: number
  chaptersCompleted: number
  rank: number
  totalPlayers: number
}

export class LeaderboardManager {
  /**
   * Get top N players from the leaderboard
   */
  static async getTopPlayers(limit = 100): Promise<LeaderboardPlayer[]> {
    const supabase = await createClient()

    try {
      console.log("[v0] LeaderboardManager: Fetching top", limit, "players")

      const { data, error } = await supabase.rpc("get_top_players", {
        p_limit: limit,
      })

      if (error) {
        console.error("[v0] LeaderboardManager: Error fetching top players:", error)
        throw error
      }

      if (!data || data.length === 0) {
        console.log("[v0] LeaderboardManager: No players found")
        return []
      }

      console.log("[v0] LeaderboardManager: Found", data.length, "players")

      return data.map((player: any) => ({
        userId: player.user_id,
        username: player.username || player.first_name || "Anonymous",
        firstName: player.first_name || "Anonymous",
        totalScore: player.total_pp || 0,
        chaptersCompleted: player.chapters_completed || 0,
        themesCompleted: player.themes_completed || 0,
        rank: Number(player.rank),
      }))
    } catch (error) {
      console.error("[v0] LeaderboardManager: Failed to get top players:", error)
      throw error
    }
  }

  /**
   * Get a specific user's rank
   */
  static async getUserRank(userId: string): Promise<UserRank | null> {
    const supabase = await createClient()

    try {
      console.log("[v0] LeaderboardManager: Fetching rank for user", userId)

      const { data, error } = await supabase.rpc("get_user_rank", {
        p_user_id: userId,
      })

      if (error) {
        console.error("[v0] LeaderboardManager: Error fetching user rank:", error)
        throw error
      }

      if (!data || data.length === 0) {
        console.log("[v0] LeaderboardManager: No rank found for user")
        return null
      }

      const rankData = data[0]
      console.log("[v0] LeaderboardManager: User rank:", rankData)

      return {
        rank: Number(rankData.rank) || 0,
        totalPlayers: Number(rankData.total_players) || 0,
      }
    } catch (error) {
      console.error("[v0] LeaderboardManager: Failed to get user rank:", error)
      return null
    }
  }

  /**
   * Get global leaderboard statistics
   */
  static async getLeaderboardStats(): Promise<LeaderboardStats> {
    const supabase = await createClient()

    try {
      console.log("[v0] LeaderboardManager: Fetching leaderboard stats")

      const { data, error } = await supabase.rpc("get_leaderboard_stats")

      if (error) {
        console.error("[v0] LeaderboardManager: Error fetching stats:", error)
        throw error
      }

      if (!data || data.length === 0) {
        console.log("[v0] LeaderboardManager: No stats found, returning defaults")
        return {
          totalPlayers: 0,
          averageChapters: 0,
          topScore: 0,
          completionRate: 0,
        }
      }

      const stats = data[0]
      console.log("[v0] LeaderboardManager: Stats:", stats)

      return {
        totalPlayers: Number(stats.total_players) || 0,
        averageChapters: Number(stats.avg_chapters) || 0,
        topScore: Number(stats.top_score) || 0,
        completionRate: Number(stats.completion_rate) || 0,
      }
    } catch (error) {
      console.error("[v0] LeaderboardManager: Failed to get stats:", error)
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
      message += `   📚 ${player.chaptersCompleted} capitoli • 🎭 ${player.themesCompleted} temi\n`
      message += `   ⭐ ${player.totalScore} punti\n\n`
    })

    // Add user's rank if provided
    if (userRank) {
      message += `📊 <b>La Tua Posizione:</b> ${userRank.rank}/${userRank.totalPlayers}\n\n`
    }

    message += "<i>🎯 Classifica basata sui PP (Power Points)</i>\n"
    message += "<i>Continua a giocare per guadagnare PP e scalare la classifica! 🌟</i>"

    return message
  }

  /**
   * Get leaderboard (alias for getTopPlayers for consistency)
   */
  static async getLeaderboard(limit = 100): Promise<LeaderboardPlayer[]> {
    return this.getTopPlayers(limit)
  }

  /**
   * Get complete user statistics including rank and progress
   */
  static async getUserStats(userId: string): Promise<UserStats | null> {
    const supabase = await createClient()

    try {
      console.log("[v0] LeaderboardManager: Fetching user stats for", userId)

      // Get user rank
      const rankInfo = await this.getUserRank(userId)
      
      // Get user progress data
      const { data: progressData, error: progressError } = await supabase
        .from("user_progress")
        .select("total_pp, themes_completed, chapters_completed")
        .eq("user_id", userId)
        .single()

      if (progressError) {
        console.error("[v0] LeaderboardManager: Error fetching user progress:", progressError)
        return null
      }

      return {
        userId,
        totalPP: progressData?.total_pp || 0,
        themesCompleted: progressData?.themes_completed || 0,
        chaptersCompleted: progressData?.chapters_completed || 0,
        rank: rankInfo?.rank || 0,
        totalPlayers: rankInfo?.totalPlayers || 0,
      }
    } catch (error) {
      console.error("[v0] LeaderboardManager: Failed to get user stats:", error)
      return null
    }
  }

  /**
   * Helper to get user ID from telegram ID
   */
  static async getUserIdFromTelegramId(telegramId: number): Promise<string | null> {
    const supabase = await createClient()

    try {
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", telegramId)
        .single()

      if (error || !data) {
        console.error("[v0] LeaderboardManager: Failed to get user ID from telegram ID:", error)
        return null
      }

      return data.id
    } catch (error) {
      console.error("[v0] LeaderboardManager: Error in getUserIdFromTelegramId:", error)
      return null
    }
  }
}
