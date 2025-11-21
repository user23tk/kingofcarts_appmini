import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireDebugAuth } from "@/lib/security/debug-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireDebugAuth(request)
    if (!authCheck.authorized) {
      return authCheck.response!
    }

    const body = await request.json()
    const action = body.action || (body.repair ? "repair" : "validate")

    console.log("[v0] Validate-stats action:", action)

    if (action === "repair") {
      console.log("[v0] [SECURITY] Stats repair initiated by admin:", {
        ip: request.headers.get("x-forwarded-for") || "unknown",
        timestamp: new Date().toISOString(),
      })
    }

    const supabase = createAdminClient()

    if (action === "validate") {
      const issues: Array<{
        type: string
        severity: "error" | "warning"
        description: string
        affectedCount: number
      }> = []

      const { data: userProgressData, error: upError } = await supabase
        .from("user_progress")
        .select("user_id, completed_themes, theme_progress, total_chapters_completed, total_pp")

      if (upError) {
        console.error("[v0] Error fetching user_progress:", upError)
        return NextResponse.json({ error: "Failed to fetch user progress", details: upError }, { status: 500 })
      }

      let usersWithCompletedThemesMismatch = 0
      let usersWithInvalidChapter = 0
      let usersWithChapterCountMismatch = 0

      for (const user of userProgressData || []) {
        const themeProgress = user.theme_progress || {}
        const completedThemes = user.completed_themes || []

        const completedInProgress = Object.entries(themeProgress)
          .filter(([_, progress]: [string, any]) => progress.completed === true)
          .map(([themeId]) => themeId)

        if (JSON.stringify(completedInProgress.sort()) !== JSON.stringify([...completedThemes].sort())) {
          usersWithCompletedThemesMismatch++
        }

        for (const [themeId, progress] of Object.entries(themeProgress)) {
          const themeData = progress as any
          if (themeData.current_chapter === 0) {
            usersWithInvalidChapter++
            break
          }
        }

        const calculatedChapters = Object.values(themeProgress).reduce(
          (sum, progress: any) => sum + Math.max(0, (progress.current_chapter || 1) - 1),
          0,
        )

        if (user.total_chapters_completed !== calculatedChapters) {
          usersWithChapterCountMismatch++
        }
      }

      if (usersWithCompletedThemesMismatch > 0) {
        issues.push({
          type: "User Progress",
          severity: "error",
          description: "completed_themes array non corrisponde ai flag completed in theme_progress",
          affectedCount: usersWithCompletedThemesMismatch,
        })
      }

      if (usersWithInvalidChapter > 0) {
        issues.push({
          type: "User Progress",
          severity: "error",
          description: "Alcuni temi hanno current_chapter = 0 (dovrebbe essere >= 1)",
          affectedCount: usersWithInvalidChapter,
        })
      }

      if (usersWithChapterCountMismatch > 0) {
        issues.push({
          type: "User Progress",
          severity: "error",
          description: "total_chapters_completed non corrisponde alla somma dei capitoli completati",
          affectedCount: usersWithChapterCountMismatch,
        })
      }

      const { data: globalStats, error: gsError } = await supabase
        .from("global_stats")
        .select("stat_name, stat_value")
        .in("stat_name", ["total_chapters_completed", "total_themes_completed"])

      if (gsError) {
        console.error("[v0] Error fetching global_stats:", gsError)
        return NextResponse.json({ error: "Failed to fetch global stats", details: gsError }, { status: 500 })
      }

      let expectedChapters = 0
      let expectedThemes = 0

      for (const user of userProgressData || []) {
        // Sum of total_chapters_completed from all users
        expectedChapters += user.total_chapters_completed || 0

        // Count of completed themes from completed_themes array
        expectedThemes += (user.completed_themes || []).length
      }

      const currentChapters = globalStats?.find((s) => s.stat_name === "total_chapters_completed")?.stat_value || 0
      const currentThemes = globalStats?.find((s) => s.stat_name === "total_themes_completed")?.stat_value || 0

      if (currentChapters !== expectedChapters) {
        issues.push({
          type: "Global Stats",
          severity: "error",
          description: `total_chapters_completed non corrisponde (attuale: ${currentChapters}, atteso: ${expectedChapters})`,
          affectedCount: 1,
        })
      }

      if (currentThemes !== expectedThemes) {
        issues.push({
          type: "Global Stats",
          severity: "error",
          description: `total_themes_completed non corrisponde (attuale: ${currentThemes}, atteso: ${expectedThemes})`,
          affectedCount: 1,
        })
      }

      return NextResponse.json({
        isValid: issues.length === 0,
        issues,
        summary: {
          totalUsers: userProgressData?.length || 0,
          usersWithIssues: usersWithCompletedThemesMismatch + usersWithInvalidChapter + usersWithChapterCountMismatch,
          totalIssues: issues.length,
          expectedGlobalChapters: expectedChapters,
          currentGlobalChapters: currentChapters,
          expectedGlobalThemes: expectedThemes,
          currentGlobalThemes: currentThemes,
        },
      })
    } else if (action === "repair") {
      const repairs: Array<{
        userId: string
        repairType: string
        oldValue: string
        newValue: string
      }> = []

      const { data: userProgressData, error: upError } = await supabase
        .from("user_progress")
        .select("user_id, completed_themes, theme_progress, total_chapters_completed, total_pp")

      if (upError) {
        console.error("[v0] Error fetching user_progress:", upError)
        return NextResponse.json({ error: "Failed to fetch user progress", details: upError }, { status: 500 })
      }

      for (const user of userProgressData || []) {
        const themeProgress = user.theme_progress || {}
        let needsUpdate = false
        const updatedThemeProgress = { ...themeProgress }
        let updatedCompletedThemes = [...(user.completed_themes || [])]
        let updatedTotalChapters = user.total_chapters_completed || 0

        const completedInProgress = Object.entries(themeProgress)
          .filter(([_, progress]: [string, any]) => progress.completed === true)
          .map(([themeId]) => themeId)

        if (JSON.stringify(completedInProgress.sort()) !== JSON.stringify(updatedCompletedThemes.sort())) {
          repairs.push({
            userId: user.user_id,
            repairType: "completed_themes_sync",
            oldValue: updatedCompletedThemes.join(","),
            newValue: completedInProgress.join(","),
          })
          updatedCompletedThemes = completedInProgress
          needsUpdate = true
        }

        for (const [themeId, progress] of Object.entries(themeProgress)) {
          const themeData = progress as any
          if (themeData.current_chapter === 0) {
            repairs.push({
              userId: user.user_id,
              repairType: `fix_chapter_${themeId}`,
              oldValue: "0",
              newValue: "1",
            })
            updatedThemeProgress[themeId] = { ...themeData, current_chapter: 1 }
            needsUpdate = true
          }
        }

        const correctTotalChapters = Object.values(updatedThemeProgress).reduce(
          (sum, progress: any) => sum + Math.max(0, (progress.current_chapter || 1) - 1),
          0,
        )

        if (updatedTotalChapters !== correctTotalChapters) {
          repairs.push({
            userId: user.user_id,
            repairType: "recalculate_total_chapters",
            oldValue: String(updatedTotalChapters),
            newValue: String(correctTotalChapters),
          })
          updatedTotalChapters = correctTotalChapters
          needsUpdate = true
        }

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from("user_progress")
            .update({
              completed_themes: updatedCompletedThemes,
              theme_progress: updatedThemeProgress,
              total_chapters_completed: updatedTotalChapters,
            })
            .eq("user_id", user.user_id)

          if (updateError) {
            console.error(`[v0] Error updating user ${user.user_id}:`, updateError)
          }
        }
      }

      const { data: userProgressDataForGlobal } = await supabase
        .from("user_progress")
        .select("completed_themes, total_chapters_completed")

      let correctChapters = 0
      let correctThemes = 0

      for (const user of userProgressDataForGlobal || []) {
        correctChapters += user.total_chapters_completed || 0
        correctThemes += (user.completed_themes || []).length
      }

      await supabase
        .from("global_stats")
        .update({ stat_value: correctChapters })
        .eq("stat_name", "total_chapters_completed")

      await supabase
        .from("global_stats")
        .update({ stat_value: correctThemes })
        .eq("stat_name", "total_themes_completed")

      return NextResponse.json({
        success: true,
        repaired: {
          usersFixed: new Set(repairs.map((r) => r.userId)).size,
          totalRepairs: repairs.length,
          globalStatsFixed: true,
          globalChapters: correctChapters,
          globalThemes: correctThemes,
        },
        repairs,
      })
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'validate' or 'repair'" }, { status: 400 })
    }
  } catch (error) {
    console.error("[v0] Validate-stats error:", error)
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}
