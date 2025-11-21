-- ============================================================================
-- ALIGN WITH REAL DATABASE SCHEMA
-- Based on actual Supabase schema export
-- Only fixes what actually exists in the database
-- ============================================================================

-- ============================================================================
-- STEP 1: FIX DUPLICATE COLUMNS IN user_progress
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== STEP 1: Fixing duplicate columns ===';
  
  -- Sync total_chapters_completed with chapters_completed
  -- Keep both for backward compatibility but ensure they're in sync
  UPDATE user_progress
  SET chapters_completed = COALESCE(total_chapters_completed, chapters_completed, 0),
      total_chapters_completed = COALESCE(total_chapters_completed, chapters_completed, 0)
  WHERE total_chapters_completed != chapters_completed 
     OR total_chapters_completed IS NULL 
     OR chapters_completed IS NULL;
  
  RAISE NOTICE '✅ Synchronized duplicate chapter count columns';
END $$;

-- ============================================================================
-- STEP 2: CREATE TRIGGER FOR theme_progress SYNC
-- ============================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_theme_progress_trigger ON user_progress;
DROP FUNCTION IF EXISTS sync_theme_progress() CASCADE;

-- Create function to sync theme_progress with aggregate columns
CREATE OR REPLACE FUNCTION sync_theme_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_theme_key TEXT;
  v_theme_data JSONB;
  v_total_chapters INTEGER := 0;
  v_total_themes INTEGER := 0;
BEGIN
  -- Initialize theme_progress if NULL
  IF NEW.theme_progress IS NULL THEN
    NEW.theme_progress := '{}'::jsonb;
  END IF;
  
  -- Calculate totals from theme_progress JSONB
  FOR v_theme_key IN SELECT jsonb_object_keys(NEW.theme_progress)
  LOOP
    v_theme_data := NEW.theme_progress->v_theme_key;
    
    -- Sum chapters completed
    v_total_chapters := v_total_chapters + COALESCE((v_theme_data->>'chapters_completed')::INTEGER, 0);
    
    -- Count completed themes (10+ chapters)
    IF COALESCE((v_theme_data->>'chapters_completed')::INTEGER, 0) >= 10 THEN
      v_total_themes := v_total_themes + 1;
    END IF;
  END LOOP;
  
  -- Sync aggregate columns with JSONB data
  NEW.chapters_completed := v_total_chapters;
  NEW.total_chapters_completed := v_total_chapters; -- Keep both in sync
  NEW.themes_completed := v_total_themes;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER sync_theme_progress_trigger
  BEFORE INSERT OR UPDATE OF theme_progress ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION sync_theme_progress();

DO $$
BEGIN
  RAISE NOTICE '✅ Created trigger for automatic theme_progress synchronization';
END $$;

-- ============================================================================
-- STEP 3: ADD MISSING INDEXES FOR PERFORMANCE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== STEP 3: Adding performance indexes ===';
END $$;

-- Composite index for leaderboard queries on user_progress
CREATE INDEX IF NOT EXISTS idx_user_progress_leaderboard 
  ON user_progress(chapters_completed DESC, themes_completed DESC, total_pp DESC);

-- GIN index for JSONB queries on theme_progress
CREATE INDEX IF NOT EXISTS idx_user_progress_theme_progress_gin 
  ON user_progress USING GIN (theme_progress);

-- Index for pp_audit user lookups (user_id is TEXT)
CREATE INDEX IF NOT EXISTS idx_pp_audit_user_id 
  ON pp_audit(user_id);

-- Composite index for pp_audit queries
CREATE INDEX IF NOT EXISTS idx_pp_audit_user_theme 
  ON pp_audit(user_id, theme, created_at DESC);

-- Index for event_leaderboard queries
CREATE INDEX IF NOT EXISTS idx_event_leaderboard_theme_rank 
  ON event_leaderboard(theme, rank);

CREATE INDEX IF NOT EXISTS idx_event_leaderboard_theme_pp 
  ON event_leaderboard(theme, total_pp DESC);

-- Index for story_chapters lookups
CREATE INDEX IF NOT EXISTS idx_story_chapters_theme_chapter 
  ON story_chapters(theme_id, chapter_number);

DO $$
BEGIN
  RAISE NOTICE '✅ Added composite index for leaderboard queries';
  RAISE NOTICE '✅ Added GIN index on theme_progress JSONB';
  RAISE NOTICE '✅ Added indexes for pp_audit and event_leaderboard';
  RAISE NOTICE '✅ Added index for story_chapters';
END $$;

-- ============================================================================
-- STEP 4: VERIFY DATA CONSISTENCY
-- ============================================================================
DO $$
DECLARE
  v_inconsistent_count INTEGER;
BEGIN
  RAISE NOTICE '=== STEP 4: Verifying data consistency ===';
  
  -- Check for users with inconsistent chapter counts
  SELECT COUNT(*) INTO v_inconsistent_count
  FROM user_progress
  WHERE chapters_completed != COALESCE(total_chapters_completed, 0)
     OR total_chapters_completed != COALESCE(chapters_completed, 0);
  
  IF v_inconsistent_count > 0 THEN
    RAISE WARNING 'Found % users with inconsistent chapter counts', v_inconsistent_count;
    
    -- Fix inconsistencies
    UPDATE user_progress
    SET chapters_completed = COALESCE(GREATEST(chapters_completed, total_chapters_completed), 0),
        total_chapters_completed = COALESCE(GREATEST(chapters_completed, total_chapters_completed), 0)
    WHERE chapters_completed != COALESCE(total_chapters_completed, 0)
       OR total_chapters_completed != COALESCE(chapters_completed, 0);
    
    RAISE NOTICE '✅ Fixed inconsistent chapter counts';
  ELSE
    RAISE NOTICE '✅ All chapter counts are consistent';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: SUMMARY
-- ============================================================================
DO $$
DECLARE
  v_users_count INTEGER;
  v_progress_count INTEGER;
  v_events_count INTEGER;
  v_themes_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users_count FROM users;
  SELECT COUNT(*) INTO v_progress_count FROM user_progress;
  SELECT COUNT(*) INTO v_events_count FROM event_leaderboard;
  SELECT COUNT(*) INTO v_themes_count FROM themes;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'DATABASE ALIGNMENT COMPLETE';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Total users: %', v_users_count;
  RAISE NOTICE 'User progress records: %', v_progress_count;
  RAISE NOTICE 'Event leaderboard entries: %', v_events_count;
  RAISE NOTICE 'Active themes: %', v_themes_count;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Improvements applied:';
  RAISE NOTICE '  ✅ Duplicate columns synchronized';
  RAISE NOTICE '  ✅ Automatic JSONB sync enabled';
  RAISE NOTICE '  ✅ Performance indexes added';
  RAISE NOTICE '  ✅ Data consistency verified';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'NOTE: event_leaderboard.user_id is TEXT (not UUID)';
  RAISE NOTICE 'NOTE: pp_audit.user_id is TEXT (not UUID)';
  RAISE NOTICE 'These cannot have FK constraints to users.id';
  RAISE NOTICE '===========================================';
END $$;
