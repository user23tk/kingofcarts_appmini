import { createAdminClient } from "@/lib/supabase/admin"
import { PPValidator } from "@/lib/security/pp-validator"
import { QueryCache } from "@/lib/cache/query-cache"
import { EventManager } from "@/lib/story/event-manager"

export interface StoryChoice {
  id: string
  label: string
  pp_delta: number
}

export interface StoryScene {
  index: number
  text: string
  choices: StoryChoice[]
}

export interface StoryFinale {
  text: string
  nextChapter?: string
}

export interface StoryChapter {
  id: string
  title: string
  scenes: StoryScene[]
  finale: StoryFinale
}

export interface UserProgress {
  id: string
  user_id: string
  current_theme: string
  current_chapter: number
  completed_themes: string[]
  chapters_completed: number
  last_interaction: string
  total_pp?: number
  theme_progress?: Record<string, ThemeProgress>
  themes_completed?: number
  // Legacy field for backward compatibility only
  total_chapters_completed?: number
}

export interface ThemeProgress {
  current_chapter: number
  completed: boolean
  last_interaction: string
}

export interface AllThemesProgress {
  [theme: string]: ThemeProgress
}

export class StoryManager {
  async getUserProgress(userId: string, theme?: string): Promise<UserProgress | null> {
    return QueryCache.get(
      `user_progress:${userId}`,
      async () => {
        const supabase = createAdminClient()
        const { data } = await supabase.from("user_progress").select("*").eq("user_id", userId).single()
        return data
      },
      30, // Cache for 30 seconds
    )
  }

  async createUserProgress(userId: string, theme: string): Promise<UserProgress> {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("user_progress")
      .insert({
        user_id: userId,
        current_theme: theme,
        current_chapter: 1,
        completed_themes: [],
        chapters_completed: 0,
        total_pp: 0,
      })
      .select()
      .single()
    return data
  }

  async updateUserProgress(userId: string, theme: string, chapter: number, completed = false): Promise<void> {
    const supabase = createAdminClient()
    await supabase.rpc("update_theme_progress", {
      p_user_id: userId,
      p_theme: theme,
      p_chapter: chapter,
      p_completed: completed,
    })
  }

  async updateCurrentTheme(userId: string, theme: string): Promise<void> {
    const supabase = createAdminClient()
    await supabase.from("user_progress").update({ current_theme: theme }).eq("user_id", userId)

    console.log(`[v0] Updated current_theme to ${theme} for user ${userId}`)
  }

  async getChapter(theme: string, chapterNumber: number): Promise<StoryChapter | null> {
    console.log("[v0] getChapter called with theme:", theme, "chapter:", chapterNumber)

    return QueryCache.get(
      `chapter:${theme}:${chapterNumber}`,
      async () => {
        const dbChapter = await this.getChapterFromDatabase(theme, chapterNumber)
        if (dbChapter) {
          console.log("[v0] Found chapter in database:", dbChapter.id)
          return dbChapter
        }
        console.log("[v0] Chapter not found in database")
        return null
      },
      300, // Cache chapters for 5 minutes (they rarely change)
    )
  }

  private async getChapterFromDatabase(theme: string, chapterNumber: number): Promise<StoryChapter | null> {
    console.log("[v0] getChapterFromDatabase called with theme:", theme, "chapter:", chapterNumber)
    const supabase = createAdminClient()

    // Get chapter from story_chapters with proper JOIN to themes table
    const { data: storyChapter, error: storyError } = await supabase
      .from("story_chapters")
      .select(`
        *,
        themes!inner(name)
      `)
      .eq("themes.name", theme)
      .eq("chapter_number", chapterNumber)
      .eq("is_active", true)
      .single()

    console.log("[v0] story_chapters query result:", { storyChapter, storyError })

    if (storyChapter && storyChapter.content) {
      console.log("[v0] Found story chapter, content:", storyChapter.content)
      const convertedChapter = this.convertJsonbToChapter(storyChapter.content, storyChapter.id, storyChapter.title)
      console.log("[v0] Converted chapter:", convertedChapter)
      return convertedChapter
    }

    console.log("[v0] No chapter found in database")
    return null
  }

  private convertJsonbToChapter(content: any, id: string, title: string): StoryChapter {
    console.log("[v0] convertJsonbToChapter called with content:", content, "id:", id, "title:", title)

    if (content.scenes) {
      console.log("[v0] Processing scenes, total count:", content.scenes.length)
      content.scenes.forEach((scene: any, index: number) => {
        console.log(`[v0] Scene ${index}:`, {
          index: scene.index,
          hasChoices: !!scene.choices,
          choicesType: typeof scene.choices,
          choicesIsArray: Array.isArray(scene.choices),
          choicesLength: scene.choices ? scene.choices.length : "N/A",
          choicesContent: scene.choices,
        })

        if (scene.choices) {
          scene.choices.forEach((choice: any, choiceIndex: number) => {
            console.log(`[v0] Scene ${index} Choice ${choiceIndex}:`, choice)
          })
        }
      })
    }

    const chapter = {
      id: id,
      title: title,
      scenes: content.scenes || [],
      finale: content.finale || { text: "Capitolo completato!" },
    }

    console.log("[v0] Converted chapter scenes count:", chapter.scenes.length)
    console.log("[v0] First scene:", chapter.scenes[0])

    return chapter
  }

  async getAvailableChaptersCount(theme: string): Promise<number> {
    return QueryCache.get(
      `chapters_count:${theme}`,
      async () => {
        const supabase = createAdminClient()
        const { count: storyCount } = await supabase
          .from("story_chapters")
          .select("*, themes!inner(name)", { count: "exact", head: true })
          .eq("themes.name", theme)
          .eq("is_active", true)
        return storyCount || 0
      },
      300, // Cache for 5 minutes
    )
  }

  formatStoryText(text: string, playerName: string, totalPP?: number): string {
    let formatted = text.replace(/\{\{KING\}\}/g, "King of Carts").replace(/\{\{PLAYER\}\}/g, playerName)

    if (totalPP !== undefined) {
      formatted = formatted.replace(/\{\{TOTAL_PP\}\}/g, totalPP.toString())
    }

    return formatted
  }

  async completeChapter(userId: string, theme: string, ppGained: number): Promise<void> {
    const supabase = createAdminClient()

    const chapterValidation = PPValidator.validateChapterCompletion(ppGained)
    if (!chapterValidation.isValid) {
      console.error(`[SECURITY] Chapter completion validation failed: ${chapterValidation.reason} for user ${userId}`)
      throw new Error(`PP validation failed: ${chapterValidation.reason}`)
    }

    const rateLimitValidation = await PPValidator.validateRateLimits(userId, ppGained)
    if (!rateLimitValidation.isValid) {
      console.error(
        `[SECURITY] Chapter completion rate limit exceeded: ${rateLimitValidation.reason} for user ${userId}`,
      )
      throw new Error(`Rate limit exceeded: ${rateLimitValidation.reason}`)
    }

    console.log(`[v0] [PP UPDATE] Starting chapter completion for user ${userId}`)
    console.log(`[v0] [PP UPDATE] Theme: ${theme}, PP Gained: ${ppGained}`)

    const ppMultiplier = await EventManager.getPPMultiplier(theme)
    const finalPPGained = Math.floor(ppGained * ppMultiplier)

    console.log(`[v0] [PP UPDATE] PP Multiplier: ${ppMultiplier}x, Final PP: ${finalPPGained}`)

    const themeProgress = await this.getThemeProgress(userId, theme)
    const availableChapters = await this.getAvailableChaptersCount(theme)

    const isThemeCompleted = themeProgress.current_chapter >= availableChapters
    const newChapter = themeProgress.current_chapter + 1

    console.log(
      `[v0] Theme completion check: current=${themeProgress.current_chapter}, available=${availableChapters}, completed=${isThemeCompleted}`,
    )

    QueryCache.invalidate(`user_progress:${userId}`)
    QueryCache.invalidate(`dashboard:${userId}`)
    QueryCache.invalidate(`profile:${userId}`)

    const { data: progress, error: progressError } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (progressError && progressError.code !== "PGRST116") {
      console.error(`[v0] [PP UPDATE] Error fetching user_progress:`, progressError)
    }

    const oldTotalPP = progress?.total_pp || 0
    const newTotalPP = oldTotalPP + finalPPGained

    console.log(`[v0] [PP UPDATE] Old total PP: ${oldTotalPP}, New total PP: ${newTotalPP}`)

    await this.updateUserProgress(userId, theme, newChapter, isThemeCompleted)

    if (progress) {
      // Existing user - update their record
      const currentChaptersCompleted = progress.chapters_completed || 0
      const currentThemesCompleted = progress.themes_completed || 0

      const completedThemes = progress.completed_themes || []
      const isNewThemeCompletion = isThemeCompleted && !completedThemes.includes(theme)

      console.log(`[v0] [PP UPDATE] Updating existing user_progress:`, {
        chapters_completed: currentChaptersCompleted + 1,
        themes_completed: isNewThemeCompletion ? currentThemesCompleted + 1 : currentThemesCompleted,
        total_pp: newTotalPP,
      })

      const { error: updateError } = await supabase
        .from("user_progress")
        .update({
          chapters_completed: currentChaptersCompleted + 1,
          themes_completed: isNewThemeCompletion ? currentThemesCompleted + 1 : currentThemesCompleted,
          total_pp: newTotalPP,
          completed_themes: isNewThemeCompletion ? [...completedThemes, theme] : completedThemes,
        })
        .eq("user_id", userId)

      if (updateError) {
        console.error(`[v0] [PP UPDATE] Failed to update user_progress:`, updateError)
        throw new Error(`Failed to update user progress: ${updateError.message}`)
      }
    } else {
      console.log(`[v0] [PP UPDATE] Creating new user_progress for user ${userId} with PP: ${newTotalPP}`)

      const { error: insertError } = await supabase.from("user_progress").insert({
        user_id: userId,
        current_theme: theme,
        current_chapter: newChapter,
        completed_themes: isThemeCompleted ? [theme] : [],
        chapters_completed: 1,
        themes_completed: isThemeCompleted ? 1 : 0,
        total_pp: newTotalPP,
      })

      if (insertError) {
        // If insert fails due to race condition (record created by another request), try update
        console.log(`[v0] [PP UPDATE] Insert failed, attempting upsert:`, insertError)

        const { error: upsertError } = await supabase.from("user_progress").upsert(
          {
            user_id: userId,
            current_theme: theme,
            current_chapter: newChapter,
            completed_themes: isThemeCompleted ? [theme] : [],
            chapters_completed: 1,
            themes_completed: isThemeCompleted ? 1 : 0,
            total_pp: newTotalPP,
          },
          { onConflict: "user_id" },
        )

        if (upsertError) {
          console.error(`[v0] [PP UPDATE] Failed to upsert user_progress:`, upsertError)
          throw new Error(`Failed to create/update user progress: ${upsertError.message}`)
        }
      }
    }

    const { data: verifyData } = await supabase
      .from("user_progress")
      .select("total_pp, chapters_completed, themes_completed, completed_themes")
      .eq("user_id", userId)
      .single()

    console.log(`[v0] [PP UPDATE] Verified user_progress after update:`, verifyData)

    if (verifyData && verifyData.total_pp !== newTotalPP) {
      console.error(`[v0] [PP UPDATE] WARNING: PP mismatch! Expected ${newTotalPP}, got ${verifyData.total_pp}`)
    }

    try {
      await EventManager.updateEventLeaderboard(userId, theme, finalPPGained)
      console.log(`[v0] [PP UPDATE] Updated event leaderboard for theme ${theme}`)
    } catch (eventError) {
      console.error(`[v0] [PP UPDATE] Failed to update event leaderboard:`, eventError)
      // Don't throw - event leaderboard update shouldn't block the main flow
    }

    QueryCache.invalidate(`user_progress:${userId}`)
    QueryCache.invalidate(`dashboard:${userId}`)
    QueryCache.invalidate(`profile:${userId}`)
    QueryCache.invalidate(`user:${userId}`)
    QueryCache.invalidatePattern(`leaderboard`)

    await supabase.rpc("increment_global_stat", {
      stat_name_param: "total_chapters_completed",
    })

    if (isThemeCompleted) {
      const completedThemes = progress?.completed_themes || []
      if (!completedThemes.includes(theme)) {
        await supabase.rpc("increment_global_stat", {
          stat_name_param: "total_themes_completed",
        })
        console.log(`[v0] Theme ${theme} completed! Incremented global theme stat.`)
      }
    }

    console.log(`[v0] [PP UPDATE] Chapter completion finished successfully`)
  }

  async getUserStats(userId: string): Promise<{
    chaptersCompleted: number
    themesCompleted: number
    currentTheme: string
    currentChapter: number
    totalPP: number
    allThemesProgress: AllThemesProgress
  }> {
    const progress = await this.getUserProgress(userId)
    const allThemesProgress = await this.getAllThemesProgress(userId)

    if (!progress) {
      return {
        chaptersCompleted: 0,
        themesCompleted: 0,
        currentTheme: "",
        currentChapter: 1,
        totalPP: 0,
        allThemesProgress: {},
      }
    }

    // current_chapter represents the NEXT chapter to play, so completed = current - 1
    const totalChapters = Object.values(allThemesProgress).reduce((total, themeProgress) => {
      return total + Math.max(0, themeProgress.current_chapter - 1)
    }, 0)

    const completedThemes = Object.values(allThemesProgress).filter((tp) => tp.completed === true).length

    return {
      chaptersCompleted: totalChapters,
      themesCompleted: completedThemes,
      currentTheme: progress.current_theme,
      currentChapter: progress.current_chapter,
      totalPP: progress.total_pp || 0,
      allThemesProgress,
    }
  }

  async getGlobalStats(): Promise<{
    totalUsers: number
    totalInteractions: number
    totalChaptersCompleted: number
    totalThemesCompleted: number
  }> {
    const supabase = createAdminClient()

    const { data } = await supabase
      .from("global_stats")
      .select("stat_name, stat_value")
      .in("stat_name", ["total_users", "total_interactions", "total_chapters_completed", "total_themes_completed"])

    const stats = {
      totalUsers: 0,
      totalInteractions: 0,
      totalChaptersCompleted: 0,
      totalThemesCompleted: 0,
    }

    data?.forEach((stat) => {
      switch (stat.stat_name) {
        case "total_users":
          stats.totalUsers = stat.stat_value
          break
        case "total_interactions":
          stats.totalInteractions = stat.stat_value
          break
        case "total_chapters_completed":
          stats.totalChaptersCompleted = stat.stat_value
          break
        case "total_themes_completed":
          stats.totalThemesCompleted = stat.stat_value
          break
      }
    })

    return stats
  }

  getAvailableThemes(): Array<{ name: string; emoji: string; displayName: string }> {
    return [
      { name: "fantasy", emoji: "🏰", displayName: "Fantasia" },
      { name: "sci-fi", emoji: "🚀", displayName: "Fantascienza" },
      { name: "mystery", emoji: "🔍", displayName: "Mistero" },
      { name: "romance", emoji: "💕", displayName: "Romantico" },
      { name: "adventure", emoji: "🗺️", displayName: "Avventura" },
      { name: "horror", emoji: "👻", displayName: "Horror" },
      { name: "comedy", emoji: "😂", displayName: "Commedia" },
    ]
  }

  async isValidTheme(theme: string): Promise<boolean> {
    const supabase = createAdminClient()
    const { data } = await supabase.from("themes").select("name").eq("name", theme).eq("is_active", true).single()

    return !!data
  }

  async getThemeProgress(userId: string, theme: string): Promise<ThemeProgress> {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc("get_theme_progress", {
      p_user_id: userId,
      p_theme_name: theme,
    })

    if (error) {
      console.error("[v0] Error fetching theme progress:", error)
      // Return safe default if RPC fails
      return {
        current_chapter: 1,
        completed: false,
        last_interaction: new Date().toISOString(),
      }
    }

    if (data) {
      const validatedChapter = Math.max(1, data.current_chapter || 1)
      console.log("[v0] Theme progress retrieved:", {
        theme,
        originalChapter: data.current_chapter,
        validatedChapter,
        completed: data.completed,
      })

      return {
        current_chapter: validatedChapter,
        completed: data.completed || false,
        last_interaction: data.last_interaction || new Date().toISOString(),
      }
    }

    return {
      current_chapter: 1,
      completed: false,
      last_interaction: new Date().toISOString(),
    }
  }

  async getAllThemesProgress(userId: string): Promise<AllThemesProgress> {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc("get_all_theme_progress", {
      p_user_id: userId.toString(),
    })

    if (error) {
      console.error("[v0] Error fetching all themes progress:", error)
      return {}
    }

    const progress: AllThemesProgress = {}

    if (data) {
      data.forEach((row: any) => {
        progress[row.theme] = {
          current_chapter: row.current_chapter,
          completed: row.completed,
          last_interaction: row.last_interaction,
        }
      })
    }

    return progress
  }
}
