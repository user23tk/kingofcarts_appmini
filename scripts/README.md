# King of Carts - Database Migration Scripts

This directory contains SQL scripts for database setup and migrations.
Scripts should be executed in numerical order.

## Core Structure (001-010)
- `001_create_users_table.sql`: Core users table
- `002_create_themes_table.sql`: Themes definition
- `003_create_user_progress_table.sql`: Progress tracking
- `004_create_global_stats_table.sql`: Global statistics
- `005_create_story_sessions_table.sql`: Session management
- `006_enhanced_security.sql`: RLS policies
- `007_fix_global_stats_constraint.sql`: Constraints fix
- `008_create_rpc_functions.sql`: Essential RPCs

## Feature Implementation (011-020)
- `011_create_events_table.sql`: Event system
- `012_create_leaderboard_functions.sql`: Leaderboard RPCs
- `013_fix_rate_limits.sql`: Rate limiting functions
- `014_fix_user_stats_triggers.sql`: Progress triggers
- `015_final_cleanup.sql`: Cleanup of old functions

## Post-Beta Fixes (100+)
- `100_apply_all_fixes.sql`: Consolidated fixes for Beta 3.6
- `101_fix_missing_rpc_functions.sql`: Missing RPCs
- `102_sync_duplicate_fields.sql`: Data consistency
- `103_remove_broken_leaderboard.sql`: Cleanup
- `105_test_consistency.sql`: Integrity checks

## How to run
Use the Supabase dashboard or the v0 SQL execution tool to run these scripts in order.
\`\`\`

\`\`\`sql file="scripts/015_fix_global_stats_constraint.sql" isDeleted="true" isMoved="true" isMovedTo="scripts/deprecated/015_fix_global_stats_constraint.sql"
...moved to scripts/deprecated/015_fix_global_stats_constraint.sql...
