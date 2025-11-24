-- ============================================================================
-- Event Leaderboard Migration Script
-- Purpose: Migrate event_leaderboard to PP-first UUID-based system
-- WARNING: Run analysis script (060) first to verify data integrity
-- ============================================================================

-- 1. Backup original table
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_leaderboard_backup') THEN
    CREATE TABLE event_leaderboard_backup AS SELECT * FROM event_leaderboard;
    RAISE NOTICE 'Backup table created: event_leaderboard_backup';
  ELSE
    RAISE NOTICE 'Backup table already exists, skipping backup creation';
  END IF;
END
$$;

-- 2. Drop existing constraints if any
ALTER TABLE event_leaderboard DROP CONSTRAINT IF EXISTS event_leaderboard_pkey;
ALTER TABLE event_leaderboard DROP CONSTRAINT IF EXISTS fk_event_leaderboard_user;

-- 3. Convert user_id from TEXT to UUID
ALTER TABLE event_leaderboard 
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

-- 4. Add event_id column for future event management
ALTER TABLE event_leaderboard 
  ADD COLUMN IF NOT EXISTS event_id UUID;

-- 5. Add FK constraint to users table
ALTER TABLE event_leaderboard
  ADD CONSTRAINT fk_event_leaderboard_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 6. Drop rank column (will be calculated dynamically)
ALTER TABLE event_leaderboard 
  DROP COLUMN IF EXISTS rank;

-- 7. Create PP-first indexes for optimal query performance
DROP INDEX IF EXISTS idx_event_leaderboard_pp_first;
DROP INDEX IF EXISTS idx_event_leaderboard_user_theme;
DROP INDEX IF EXISTS idx_event_leaderboard_theme;

CREATE INDEX idx_event_leaderboard_pp_first 
  ON event_leaderboard(theme, total_pp DESC, chapters_completed DESC, created_at ASC);

CREATE INDEX idx_event_leaderboard_user_theme
  ON event_leaderboard(user_id, theme);

CREATE INDEX idx_event_leaderboard_theme
  ON event_leaderboard(theme);

-- 8. Add primary key
ALTER TABLE event_leaderboard
  ADD CONSTRAINT event_leaderboard_pkey 
  PRIMARY KEY (user_id, theme);

-- 9. Verify migration
DO $$
DECLARE
  record_count INTEGER;
  user_count INTEGER;
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO record_count FROM event_leaderboard;
  SELECT COUNT(DISTINCT user_id) INTO user_count FROM event_leaderboard;
  
  SELECT COUNT(*) INTO orphan_count
  FROM event_leaderboard el
  LEFT JOIN users u ON el.user_id = u.id
  WHERE u.id IS NULL;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - Total records: %', record_count;
  RAISE NOTICE '  - Unique users: %', user_count;
  RAISE NOTICE '  - Orphaned records: %', orphan_count;
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % orphaned records! Run cleanup script.', orphan_count;
  END IF;
END
$$;
