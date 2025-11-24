-- =====================================================
-- Migration: 040_leaderboard_pp_first.sql
-- Date: 2024-11-24
-- Description: Refactor leaderboard to use PP (total_pp) as primary ranking metric
-- =====================================================

-- IMPORTANT: This migration changes the ranking algorithm to prioritize PP (Power Points)
-- New order: total_pp DESC, themes_completed DESC, chapters_completed DESC

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.get_user_rank(BIGINT);
DROP FUNCTION IF EXISTS public.get_user_rank(UUID);
DROP FUNCTION IF EXISTS public.get_top_players(INTEGER);

-- =====================================================
-- Function: get_user_rank
-- Description: Calculate user's rank based on PP-first algorithm
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id UUID)
RETURNS TABLE (
  rank BIGINT,
  total_players BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_users AS (
    SELECT
      user_id,
      ROW_NUMBER() OVER (
        ORDER BY
          total_pp DESC,           -- PP is now the PRIMARY ranking metric
          themes_completed DESC,   -- Themes as secondary tie-breaker
          chapters_completed DESC  -- Chapters as tertiary tie-breaker
      ) as user_rank
    FROM user_progress
    WHERE total_pp > 0  -- Include anyone with at least 1 PP
  )
  SELECT
    COALESCE(ru.user_rank, 0)::BIGINT as rank,
    COALESCE((SELECT COUNT(*) FROM user_progress WHERE total_pp > 0), 0)::BIGINT as total_players
  FROM ranked_users ru
  WHERE ru.user_id = p_user_id;

  -- If user not found or has 0 PP, return rank 0
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::BIGINT, (SELECT COUNT(*) FROM user_progress WHERE total_pp > 0)::BIGINT;
  END IF;
END;
$$;

-- =====================================================
-- Function: get_top_players
-- Description: Get top N players ordered by PP-first algorithm
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_top_players(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  chapters_completed INTEGER,
  themes_completed INTEGER,
  total_pp INTEGER,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.user_id,
    u.username,
    u.first_name,
    up.chapters_completed,
    up.themes_completed,
    up.total_pp,
    ROW_NUMBER() OVER (
      ORDER BY
        up.total_pp DESC,           -- PP is now the PRIMARY ranking metric
        up.themes_completed DESC,   -- Themes as secondary tie-breaker
        up.chapters_completed DESC  -- Chapters as tertiary tie-breaker
    ) as rank
  FROM user_progress up
  JOIN users u ON u.id = up.user_id
  WHERE up.total_pp > 0  -- Include anyone with at least 1 PP
  ORDER BY
    up.total_pp DESC,
    up.themes_completed DESC,
    up.chapters_completed DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- Function: get_leaderboard_stats (Updated for consistency)
-- Description: Calculate global leaderboard statistics
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_leaderboard_stats()
RETURNS TABLE (
  total_players INTEGER,
  avg_chapters NUMERIC,
  top_score INTEGER,
  completion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_players,
    AVG(chapters_completed) as avg_chapters,
    MAX(total_pp)::INTEGER as top_score,  -- Now using PP as the main score
    (COUNT(CASE WHEN themes_completed >= 7 THEN 1 END)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) as completion_rate
  FROM user_progress
  WHERE total_pp > 0;  -- Only count players with PP
END;
$$;

-- =====================================================
-- Add indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_progress_pp_ranking 
ON user_progress(total_pp DESC, themes_completed DESC, chapters_completed DESC)
WHERE total_pp > 0;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION public.get_user_rank(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_rank(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_top_players(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_players(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_stats() TO anon;

-- =====================================================
-- Migration complete
-- =====================================================
COMMENT ON FUNCTION public.get_user_rank IS 'Get user rank based on PP-first algorithm. Returns rank=0 if user has no PP.';
COMMENT ON FUNCTION public.get_top_players IS 'Get top players ordered by PP as primary metric, themes and chapters as tie-breakers.';
COMMENT ON FUNCTION public.get_leaderboard_stats IS 'Get global leaderboard statistics with PP as the main score metric.';
