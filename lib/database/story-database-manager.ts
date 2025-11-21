import { createClient } from "@/lib/supabase/server"

export interface Theme {
  id: string
  name: string
  title: string
  description: string
  is_active: boolean
}

export interface Chapter {
  id: string
  theme_id: string
  chapter_number: number
  title: string
  content: any // JSON content
  version: number
  is_active: boolean
}

export class StoryDatabaseManager {
  private async getSupabaseClient() {
    return await createClient()
  }

  async migrateJsonToDatabase(storiesData: any) {
    const supabase = await this.getSupabaseClient()
    const results = {
      themes: [] as Theme[],
      chapters: [] as Chapter[],
      errors: [] as string[],
    }

    try {
      for (const [themeName, themeData] of Object.entries(storiesData.themes)) {
        const themeRecord = {
          name: themeName,
          title: (themeData as any).title || themeName,
          description: (themeData as any).description || `${themeName} themed stories`,
          is_active: true,
        }

        const { data: theme, error: themeError } = await supabase
          .from("themes")
          .upsert(themeRecord, { onConflict: "name" })
          .select()
          .single()

        if (themeError) {
          results.errors.push(`Theme ${themeName}: ${themeError.message}`)
          continue
        }

        results.themes.push(theme)

        const chapters = (themeData as any).chapters || []
        for (let i = 0; i < chapters.length; i++) {
          const chapterData = chapters[i]
          const chapterRecord = {
            theme_id: theme.id,
            chapter_number: i + 1,
            title: chapterData.title || `Chapter ${i + 1}`,
            content: chapterData,
            version: 1,
            is_active: true,
          }

          const { data: chapter, error: chapterError } = await supabase
            .from("story_chapters")
            .upsert(chapterRecord, { onConflict: "theme_id,chapter_number" })
            .select()
            .single()

          if (chapterError) {
            results.errors.push(`Chapter ${i + 1} for ${themeName}: ${chapterError.message}`)
          } else {
            results.chapters.push(chapter)
          }
        }
      }

      return results
    } catch (error) {
      results.errors.push(`Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      return results
    }
  }

  async getThemes(): Promise<Theme[]> {
    const supabase = await this.getSupabaseClient()
    const { data, error } = await supabase.from("themes").select("*").eq("is_active", true).order("name")

    if (error) throw error
    return data || []
  }

  async getChaptersByTheme(themeName: string): Promise<Chapter[]> {
    const supabase = await this.getSupabaseClient()
    const { data, error } = await supabase
      .from("story_chapters")
      .select(`
        *,
        themes!inner(name)
      `)
      .eq("themes.name", themeName)
      .eq("is_active", true)
      .order("chapter_number")

    if (error) throw error
    return data || []
  }

  async getChapter(themeName: string, chapterNumber: number): Promise<Chapter | null> {
    const supabase = await this.getSupabaseClient()
    const { data, error } = await supabase
      .from("story_chapters")
      .select(`
        *,
        themes!inner(name)
      `)
      .eq("themes.name", themeName)
      .eq("chapter_number", chapterNumber)
      .eq("is_active", true)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null // No rows found
      throw error
    }
    return data
  }

  async saveGeneratedChapter(themeName: string, chapterData: any): Promise<Chapter> {
    const supabase = await this.getSupabaseClient()

    const { data: theme, error: themeError } = await supabase.from("themes").select("id").eq("name", themeName).single()

    if (themeError) throw themeError

    const { data: lastChapter } = await supabase
      .from("story_chapters")
      .select("chapter_number")
      .eq("theme_id", theme.id)
      .order("chapter_number", { ascending: false })
      .limit(1)
      .single()

    const nextChapterNumber = (lastChapter?.chapter_number || 0) + 1

    const chapterRecord = {
      theme_id: theme.id,
      chapter_number: nextChapterNumber,
      title: chapterData.title || `Generated Chapter ${nextChapterNumber}`,
      content: chapterData,
      version: 1,
      is_active: true,
    }

    const { data: chapter, error } = await supabase.from("story_chapters").insert(chapterRecord).select().single()

    if (error) throw error
    return chapter
  }
}
