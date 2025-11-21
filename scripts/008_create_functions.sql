-- Function to get players with better score
CREATE OR REPLACE FUNCTION get_players_with_better_score(
  p_chapters_completed INTEGER,
  p_themes_completed INTEGER
) RETURNS INTEGER AS $$
DECLARE
  better_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO better_count
  FROM user_progress
  WHERE 
    (chapters_completed > p_chapters_completed)
    OR (chapters_completed = p_chapters_completed AND themes_completed > p_themes_completed)
    OR (chapters_completed = p_chapters_completed AND themes_completed = p_themes_completed AND total_pp > (SELECT total_pp FROM user_progress WHERE chapters_completed = p_chapters_completed AND themes_completed = p_themes_completed LIMIT 1));
  
  RETURN COALESCE(better_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get leaderboard stats
CREATE OR REPLACE FUNCTION get_leaderboard_stats()
RETURNS TABLE(
  total_players BIGINT,
  avg_chapters NUMERIC,
  top_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_players,
    COALESCE(AVG(chapters_completed), 0) as avg_chapters,
    COALESCE(MAX(total_pp), 0)::INTEGER as top_score
  FROM user_progress;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active event
CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE(
  id UUID,
  name TEXT,
  theme_name TEXT,
  multiplier NUMERIC,
  end_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    t.name as theme_name,
    e.multiplier,
    e.end_date
  FROM events e
  LEFT JOIN themes t ON e.theme_id = t.id
  WHERE e.is_active = true
    AND e.start_date <= NOW()
    AND e.end_date >= NOW()
  ORDER BY e.start_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate expired events
CREATE OR REPLACE FUNCTION deactivate_expired_events()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE events
  SET is_active = false
  WHERE is_active = true
    AND end_date < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_players_with_better_score(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_event() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO anon, authenticated;
