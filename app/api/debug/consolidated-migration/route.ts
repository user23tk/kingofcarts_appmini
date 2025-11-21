import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get("authorization")
    const adminKey = process.env.DEBUG_ADMIN_KEY

    if (!adminKey || !authHeader || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    return NextResponse.json({
      totalUsers,
      migratedUsers: usersWithThemeProgress,
      pendingUsers: usersNeedingMigration,
      lastMigration,
      migrationNeeded: usersNeedingMigration > 0,
      migrationComplete: usersNeedingMigration === 0 && usersWithThemeProgress > 0,
    })
  } catch (error) {
    console.error("[v0] Migration status error:", error)
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
  try {
    // Verify admin authentication
    const authHeader = request.headers.get("authorization")
    const adminKey = process.env.DEBUG_ADMIN_KEY

    if (!adminKey || !authHeader || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    // Check current migration status
    const { data: currentUsers } = await supabase.from("user_progress").select("user_id, current_theme, theme_progress")

    const usersNeedingMigration =
      currentUsers?.filter((u) => u.current_theme && (!u.theme_progress || Object.keys(u.theme_progress).length === 0))
        .length || 0

    if (usersNeedingMigration === 0) {
      return NextResponse.json({
        success: true,
        message: "No migration needed - all users already migrated",
        migratedCount: 0,
        totalUsers: currentUsers?.length || 0,
      })
    }

    // Run migration
    const { data: migratedCount, error } = await supabase.rpc("migrate_user_progress")

    if (error) {
      console.error("[v0] Migration error:", error)
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

    console.log("[v0] Progress migration completed:", {
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
    console.error("[v0] Migration API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
