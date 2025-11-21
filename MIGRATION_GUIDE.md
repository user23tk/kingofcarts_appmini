# Migration Guide: Legacy Data Import

This guide explains how to import data from the button-based version to the current Mini App version.

## Overview

The script `scripts/030_import_legacy_data.sql` handles the conversion of legacy data to the new schema with the following transformations:

### Schema Differences

**Themes:**
- Removed: `share_bonus_pp` (not in new schema)
- Added emojis for better UI

**Users:**
- `telegram_id`: text → bigint conversion
- `is_bot`: text → boolean conversion

**User Progress:**
- `completed_themes`: JSON string → ARRAY type
- `total_pp`: text → integer conversion
- Added: `chapters_completed` (copy of `total_chapters_completed`)
- Added: `themes_completed` (calculated from `theme_progress`)

**Story Chapters:**
- Schema remains the same, direct import

## How to Import Your Data

### Step 1: Prepare the SQL Files

You provided 4 SQL files from the legacy version:
- `themes_rows.sql`
- `story_chapters_rows.sql`
- `users_rows.sql`
- `user_progress_rows.sql`

### Step 2: Update the Migration Script

The migration script `030_import_legacy_data.sql` currently has only **sample data**. You need to:

1. Open each of your SQL files
2. Copy the INSERT VALUES from your files
3. Paste them into the corresponding section of `030_import_legacy_data.sql`

**Example for Users:**

Replace this section:
\`\`\`sql
FROM (VALUES
  ('00fb17dc-5834...', '557207727', 'IM20k24', ...),
  ('014d17f4-c586...', '695354460', 'jagmut', ...)
  -- Add more users here...
)
\`\`\`

With ALL the user rows from your `users_rows.sql` file.

### Step 3: Run the Migration

1. Go to the Supabase SQL Editor (or use the v0 script runner)
2. Paste the complete migration script
3. Execute it
4. Check for errors

### Step 4: Verify the Import

Run these verification queries:

\`\`\`sql
-- Check counts
SELECT COUNT(*) FROM themes;
SELECT COUNT(*) FROM story_chapters;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM user_progress;

-- Check event themes
SELECT * FROM themes WHERE is_event = true;

-- Check user progress samples
SELECT * FROM user_progress LIMIT 5;

-- Verify data types
SELECT 
  user_id,
  current_theme,
  total_pp,
  completed_themes,
  themes_completed
FROM user_progress
LIMIT 10;
\`\`\`

## Data Transformations Applied

### 1. Completed Themes Array
**Before:** `'"{]}"'` (malformed JSON string)
**After:** `'{}'` (empty PostgreSQL ARRAY)

### 2. Total PP
**Before:** `'72'` (text)
**After:** `72` (integer)

### 3. Telegram ID
**Before:** `'557207727'` (text)
**After:** `557207727` (bigint)

## Conflict Resolution

The script uses `ON CONFLICT ... DO UPDATE` to handle existing records:
- **Themes**: Updates if ID exists
- **Users**: Updates if telegram_id exists
- **User Progress**: Updates if user_id exists
- **Story Chapters**: Updates if ID exists

This means you can **run the script multiple times** safely.

## Need Help?

If you need help completing the migration:
1. Share any errors from the SQL execution
2. I can create a complete script with all your data included
3. I can create a Node.js script to automate the conversion

## Next Steps

After successful import:
1. Test the Mini App with imported data
2. Verify leaderboards show correct user stats
3. Check that themes load properly
4. Ensure user progress is preserved
