-- Script 020: Create get_event_leaderboard_v2 RPC function
-- This function retrieves the event leaderboard with proper PP-first ordering
-- and joins with users table to get first_name

-- Drop existing function if exists (to allow recreation)
DROP FUNCTION IF EXISTS get_event_leaderboard_v2(text, integer);

CREATE OR REPLACE FUNCTION get_event_leaderboard_v2(
  p_theme TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  first_name TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY el.total_pp DESC, el.chapters_completed DESC
    ) AS rank,
    el.user_id,
    COALESCE(u.first_name, u.username, 'Anonymous') AS first_name,
    el.total_pp,
    el.chapters_completed,
    el.last_updated
  FROM event_leaderboard el
  LEFT JOIN users u ON u.id = el.user_id
  WHERE el.theme = p_theme
    AND el.total_pp > 0
  ORDER BY el.total_pp DESC, el.chapters_completed DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(text, integer) TO service_role;
