-- ============================================================================
-- Event Leaderboard Analysis Script
-- Purpose: Pre-migration analysis to identify issues
-- ============================================================================

-- 1. Verify user_id integrity (TEXT to UUID conversion)
SELECT 
  'Invalid user_id (non-UUID)' as check_type,
  el.user_id,
  el.theme,
  el.total_pp
FROM event_leaderboard el
WHERE el.user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. Verify user_id exists in users table
SELECT 
  'Orphaned user_id' as check_type,
  el.user_id,
  el.theme,
  COUNT(*) as records
FROM event_leaderboard el
LEFT JOIN users u ON el.user_id::uuid = u.id
WHERE u.id IS NULL
GROUP BY el.user_id, el.theme;

-- 3. Count records per event
SELECT 
  'Participants per event' as check_type,
  theme,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_records,
  MAX(total_pp) as max_pp,
  AVG(total_pp) as avg_pp
FROM event_leaderboard
GROUP BY theme
ORDER BY unique_users DESC;

-- 4. Verify PP consistency with user_progress
SELECT 
  'PP consistency check' as check_type,
  el.user_id,
  el.theme,
  el.total_pp as event_pp,
  up.total_pp as global_pp,
  (el.total_pp - up.total_pp) as pp_difference
FROM event_leaderboard el
LEFT JOIN user_progress up ON el.user_id::uuid = up.user_id
WHERE ABS(el.total_pp - COALESCE(up.total_pp, 0)) > 0
ORDER BY ABS(el.total_pp - COALESCE(up.total_pp, 0)) DESC
LIMIT 20;

-- 5. Check for duplicate entries
SELECT 
  'Duplicate entries' as check_type,
  user_id,
  theme,
  COUNT(*) as duplicate_count
FROM event_leaderboard
GROUP BY user_id, theme
HAVING COUNT(*) > 1;

-- 6. Analyze rank distribution
SELECT 
  'Rank distribution' as check_type,
  theme,
  MIN(rank) as min_rank,
  MAX(rank) as max_rank,
  COUNT(DISTINCT rank) as unique_ranks,
  COUNT(*) as total_records
FROM event_leaderboard
GROUP BY theme;

-- 7. Summary statistics
SELECT 
  'Summary statistics' as check_type,
  COUNT(DISTINCT user_id) as total_unique_users,
  COUNT(DISTINCT theme) as total_events,
  COUNT(*) as total_records,
  SUM(total_pp) as total_pp_all_events,
  AVG(total_pp) as avg_pp_per_record
FROM event_leaderboard;
