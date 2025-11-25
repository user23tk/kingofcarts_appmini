import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const supabase = await createClient()

    // Get comprehensive migration status
    const { data: users } = await supabase
      .from("user_progress")
      .select("user_id, current_theme, current_chapter, completed_themes, theme_progress, updated_at")

    const totalUsers = users?.length || 0
    const usersWithThemeProgress =
      users?.filter((u) => u.theme_progress && Object.keys(u.theme_progress).length > 0).length || 0
    const usersNeedingMigration =
      users?.filter((u) => u.current_theme && (!u.theme_progress || Object.keys(u.theme_progress).length === 0))
        .length || 0

    // Get last migration timestamp
    const lastMigration =
      users
        ?.filter((u) => u.theme_progress && Object.keys(u.theme_progress).length > 0)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]?.updated_at || null

    logger.info("debug-migration", "Migration status checked", {
      totalUsers,
      migratedUsers: usersWithThemeProgress,
      pendingUsers: usersNeedingMigration,
    })

    return NextResponse.json({
      totalUsers,
      migratedUsers: usersWithThemeProgress,
      pendingUsers: usersNeedingMigration,
      lastMigration,
      migrationNeeded: usersNeedingMigration > 0,
      migrationComplete: usersNeedingMigration === 0 && usersWithThemeProgress > 0,
    })
  } catch (error) {
    logger.error("debug-migration", "Migration status error", { error })
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireDebugAuth(request)
  if (!auth.authorized) return auth.response

  try {
    const supabase = await createClient()

    // Check current migration status
    const { data: currentUsers } = await supabase.from("user_progress").select("user_id, current_theme, theme_progress")

    const usersNeedingMigration =
      currentUsers?.filter((u) => u.current_theme && (!u.theme_progress || Object.keys(u.theme_progress).length === 0))
        .length || 0

    if (usersNeedingMigration === 0) {
      logger.info("debug-migration", "No migration needed - all users already migrated")
      return NextResponse.json({
        success: true,
        message: "No migration needed - all users already migrated",
        migratedCount: 0,
        totalUsers: currentUsers?.length || 0,
      })
    }

    logger.warn("debug-migration", "Starting database migration", { usersNeedingMigration })

    // Run migration
    const { data: migratedCount, error } = await supabase.rpc("migrate_user_progress")

    if (error) {
      logger.error("debug-migration", "Migration failed", { error })
      return NextResponse.json(
        {
          error: "Migration failed",
          details: error.message,
        },
        { status: 500 },
      )
    }

    // Verify results
    const { data: postMigrationUsers } = await supabase.from("user_progress").select("user_id, theme_progress")
    const successfullyMigrated =
      postMigrationUsers?.filter((u) => u.theme_progress && Object.keys(u.theme_progress).length > 0).length || 0

    logger.info("debug-migration", "Migration completed successfully", {
      migratedCount,
      successfullyMigrated,
      totalUsers: postMigrationUsers?.length || 0,
    })

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      migratedCount,
      successfullyMigrated,
      totalUsers: postMigrationUsers?.length || 0,
    })
  } catch (error) {
    logger.error("debug-migration", "Migration API error", { error })
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
