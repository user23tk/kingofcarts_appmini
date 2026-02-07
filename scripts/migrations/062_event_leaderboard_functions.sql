-- ============================================================================
-- Event Leaderboard Functions (PP-First)
-- Purpose: RPC functions for event leaderboard with PP-first ranking
-- ============================================================================

-- Function: get_event_leaderboard_v2
-- Purpose: Get event leaderboard with PP-first ranking
DROP FUNCTION IF EXISTS get_event_leaderboard_v2(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_event_leaderboard_v2(
  p_theme TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  rank BIGINT,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_players AS (
    SELECT 
      el.user_id,
      u.username,
      u.first_name,
      el.total_pp,
      el.chapters_completed,
      el.last_updated,
      ROW_NUMBER() OVER (
        ORDER BY 
          el.total_pp DESC,
          el.chapters_completed DESC,
          el.created_at ASC
      ) as rank
    FROM event_leaderboard el
    INNER JOIN users u ON el.user_id = u.id
    WHERE el.theme = p_theme
      AND el.total_pp > 0
  )
  SELECT 
    rp.user_id,
    rp.username,
    rp.first_name,
    rp.total_pp,
    rp.chapters_completed,
    rp.rank,
    rp.last_updated
  FROM ranked_players rp
  ORDER BY rp.rank ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: get_user_event_stats
-- Purpose: Get user's statistics for a specific event
DROP FUNCTION IF EXISTS get_user_event_stats(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_user_event_stats(
  p_user_id UUID,
  p_theme TEXT
)
RETURNS TABLE (
  user_id UUID,
  theme TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  rank BIGINT,
  total_participants BIGINT,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH user_data AS (
    SELECT 
      el.user_id,
      el.theme,
      el.total_pp,
      el.chapters_completed,
      el.last_updated
    FROM event_leaderboard el
    WHERE el.user_id = p_user_id
      AND el.theme = p_theme
  ),
  user_rank AS (
    SELECT 
      COUNT(*) + 1 as rank
    FROM event_leaderboard el
    WHERE el.theme = p_theme
      AND el.total_pp > 0
      AND (
        el.total_pp > (SELECT total_pp FROM user_data)
        OR (
          el.total_pp = (SELECT total_pp FROM user_data)
          AND el.chapters_completed > (SELECT chapters_completed FROM user_data)
        )
        OR (
          el.total_pp = (SELECT total_pp FROM user_data)
          AND el.chapters_completed = (SELECT chapters_completed FROM user_data)
          AND el.created_at < (SELECT last_updated FROM user_data)
        )
      )
  ),
  total_count AS (
    SELECT COUNT(*) as total
    FROM event_leaderboard el
    WHERE el.theme = p_theme
      AND el.total_pp > 0
  )
  SELECT 
    ud.user_id,
    ud.theme,
    ud.total_pp,
    ud.chapters_completed,
    COALESCE(ur.rank, 0) as rank,
    COALESCE(tc.total, 0) as total_participants,
    ud.last_updated
  FROM user_data ud
  CROSS JOIN user_rank ur
  CROSS JOIN total_count tc;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: update_event_progress_v2
-- Purpose: Update user's event progress (PP-first)
DROP FUNCTION IF EXISTS update_event_progress_v2(UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION update_event_progress_v2(
  p_user_id UUID,
  p_theme TEXT,
  p_pp_gained INTEGER,
  p_chapters_increment INTEGER DEFAULT 1
)
RETURNS TABLE (
  user_id UUID,
  theme TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  rank BIGINT
) AS $$
DECLARE
  v_new_pp INTEGER;
  v_new_chapters INTEGER;
BEGIN
  -- Insert or update event_leaderboard
  INSERT INTO event_leaderboard (user_id, theme, total_pp, chapters_completed, last_updated)
  VALUES (p_user_id, p_theme, p_pp_gained, p_chapters_increment, NOW())
  ON CONFLICT (user_id, theme)
  DO UPDATE SET
    total_pp = event_leaderboard.total_pp + p_pp_gained,
    chapters_completed = event_leaderboard.chapters_completed + p_chapters_increment,
    last_updated = NOW()
  RETURNING event_leaderboard.total_pp, event_leaderboard.chapters_completed
  INTO v_new_pp, v_new_chapters;
  
  -- Return updated stats with rank
  RETURN QUERY
  SELECT * FROM get_user_event_stats(p_user_id, p_theme);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_event_stats(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_event_progress_v2(UUID, TEXT, INTEGER, INTEGER) TO authenticated, anon;
