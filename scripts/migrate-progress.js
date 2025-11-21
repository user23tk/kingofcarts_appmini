// Node.js script to run progress migration and verify results
// Run with: node scripts/migrate-progress.js

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials")
  console.log("Required environment variables:")
  console.log("- SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL")
  console.log("- SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log("🚀 Starting progress migration...")

  try {
    // Check current state before migration
    console.log("\n📊 Pre-migration status:")
    const { data: preMigration } = await supabase.from("user_progress").select("*")

    console.log(`Total users: ${preMigration?.length || 0}`)

    const usersWithThemeProgress =
      preMigration?.filter((u) => u.theme_progress && Object.keys(u.theme_progress).length > 0).length || 0

    const usersNeedingMigration =
      preMigration?.filter((u) => u.current_theme && (!u.theme_progress || Object.keys(u.theme_progress).length === 0))
        .length || 0

    console.log(`Users with theme_progress: ${usersWithThemeProgress}`)
    console.log(`Users needing migration: ${usersNeedingMigration}`)

    if (usersNeedingMigration === 0) {
      console.log("✅ No migration needed - all users already have theme_progress data")
      return
    }

    // Run the migration function
    console.log("\n🔄 Running migration...")
    const { data: migrationResult, error } = await supabase.rpc("migrate_user_progress")

    if (error) {
      throw error
    }

    console.log(`✅ Migration completed! Migrated ${migrationResult} records`)

    // Verify results
    console.log("\n📊 Post-migration status:")
    const { data: postMigration } = await supabase.from("user_progress").select("*")

    const postUsersWithThemeProgress =
      postMigration?.filter((u) => u.theme_progress && Object.keys(u.theme_progress).length > 0).length || 0

    console.log(`Users with theme_progress: ${postUsersWithThemeProgress}`)

    // Show sample migrated data
    console.log("\n📋 Sample migrated data:")
    const { data: sampleData } = await supabase
      .from("user_progress")
      .select("user_id, current_theme, current_chapter, completed_themes, theme_progress")
      .not("theme_progress", "eq", "{}")
      .limit(3)

    sampleData?.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`)
      console.log(`  Current theme: ${user.current_theme}`)
      console.log(`  Current chapter: ${user.current_chapter}`)
      console.log(`  Completed themes: ${JSON.stringify(user.completed_themes)}`)
      console.log(`  Theme progress: ${JSON.stringify(user.theme_progress, null, 2)}`)
    })

    console.log("\n🎉 Migration verification completed successfully!")
  } catch (error) {
    console.error("❌ Migration failed:", error.message)
    console.error("Full error:", error)
    process.exit(1)
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
}

export { runMigration }
