-- Fix leaderboard columns to ensure data consistency
-- This script ensures chapters_completed and themes_completed are populated correctly

-- Update chapters_completed from total_chapters_completed if it's 0 or NULL
UPDATE user_progress
SET chapters_completed = COALESCE(total_chapters_completed, 0)
WHERE chapters_completed IS NULL OR chapters_completed = 0;

-- Update themes_completed from completed_themes array length if it's 0 or NULL
UPDATE user_progress
SET themes_completed = COALESCE(array_length(completed_themes, 1), 0)
WHERE themes_completed IS NULL OR themes_completed = 0;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_progress_chapters_completed 
ON user_progress(chapters_completed DESC);

CREATE INDEX IF NOT EXISTS idx_user_progress_themes_completed 
ON user_progress(themes_completed DESC);

-- Verify the fix
DO $$
DECLARE
  v_users_with_progress INTEGER;
  v_users_in_leaderboard INTEGER;
BEGIN
  -- Count users with any progress
  SELECT COUNT(*) INTO v_users_with_progress
  FROM user_progress
  WHERE total_chapters_completed > 0 OR total_pp > 0;
  
  -- Count users that would appear in leaderboard
  SELECT COUNT(*) INTO v_users_in_leaderboard
  FROM user_progress
  WHERE chapters_completed > 0 OR themes_completed > 0;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'LEADERBOARD FIX COMPLETED';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Users with progress: %', v_users_with_progress;
  RAISE NOTICE 'Users in leaderboard: %', v_users_in_leaderboard;
  
  IF v_users_with_progress > v_users_in_leaderboard THEN
    RAISE WARNING 'Some users with progress are not in leaderboard!';
    RAISE WARNING 'This might indicate data inconsistency.';
  ELSE
    RAISE NOTICE 'All users with progress are in leaderboard ✓';
  END IF;
  
  RAISE NOTICE '===========================================';
END $$;
