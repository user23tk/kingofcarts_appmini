-- ============================================================================
-- Fix Event Leaderboard Atomic Update Function
-- Purpose: Align the RPC function name and signature with what the code expects
-- ============================================================================

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(TEXT, TEXT, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(UUID, TEXT, INTEGER);

-- Create the function with the signature expected by the code
-- Parameters: p_user_id (TEXT), p_theme (TEXT), p_pp_gained (INTEGER)
CREATE OR REPLACE FUNCTION update_event_leaderboard_atomic(
  p_user_id TEXT,
  p_theme TEXT,
  p_pp_gained INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_user_uuid UUID;
  v_current_pp INTEGER;
  v_current_chapters INTEGER;
BEGIN
  -- Convert text user_id to UUID
  BEGIN
    v_user_uuid := p_user_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid user_id format: %', p_user_id;
  END;

  -- Lock and get current values
  SELECT total_pp, chapters_completed 
  INTO v_current_pp, v_current_chapters
  FROM event_leaderboard
  WHERE user_id = v_user_uuid AND theme = p_theme
  FOR UPDATE;

  IF FOUND THEN
    -- Update existing record
    UPDATE event_leaderboard
    SET 
      total_pp = COALESCE(v_current_pp, 0) + p_pp_gained,
      chapters_completed = COALESCE(v_current_chapters, 0) + 1,
      last_updated = NOW()
    WHERE user_id = v_user_uuid AND theme = p_theme;
    
    RAISE NOTICE '[EVENT] Updated event_leaderboard for user % theme %: PP % -> %, chapters % -> %',
      p_user_id, p_theme, v_current_pp, v_current_pp + p_pp_gained, v_current_chapters, v_current_chapters + 1;
  ELSE
    -- Insert new record
    INSERT INTO event_leaderboard (user_id, theme, total_pp, chapters_completed, last_updated, created_at)
    VALUES (v_user_uuid, p_theme, p_pp_gained, 1, NOW(), NOW());
    
    RAISE NOTICE '[EVENT] Created event_leaderboard entry for user % theme %: PP %, chapters 1',
      p_user_id, p_theme, p_pp_gained;
  END IF;
  
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(TEXT, TEXT, INTEGER) TO authenticated, anon;

-- ============================================================================
-- Also fix get_event_leaderboard_v2 to handle potential UUID/TEXT mismatches
-- ============================================================================
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
      ) as row_rank
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
    rp.row_rank as rank,
    rp.last_updated
  FROM ranked_players rp
  ORDER BY rp.row_rank ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(TEXT, INTEGER) TO authenticated, anon;

-- ============================================================================
-- Verify data integrity
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count event leaderboard entries
  SELECT COUNT(*) INTO v_count FROM event_leaderboard;
  RAISE NOTICE 'Event leaderboard entries: %', v_count;
  
  -- Count entries with valid user joins
  SELECT COUNT(*) INTO v_count 
  FROM event_leaderboard el
  INNER JOIN users u ON el.user_id = u.id;
  RAISE NOTICE 'Event entries with valid user joins: %', v_count;
  
  -- Count active themes that are events
  SELECT COUNT(*) INTO v_count FROM themes WHERE is_event = true AND is_active = true;
  RAISE NOTICE 'Active event themes: %', v_count;
END $$;
