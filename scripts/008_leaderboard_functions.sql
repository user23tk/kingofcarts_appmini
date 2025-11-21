-- Function to get players with better score than given user
CREATE OR REPLACE FUNCTION get_players_with_better_score(
  user_chapters INTEGER,
  user_themes INTEGER,
  user_pp INTEGER
) RETURNS INTEGER AS $$
DECLARE
  user_score INTEGER;
  better_count INTEGER;
BEGIN
  -- Calculate user's score
  user_score := (user_chapters * 10) + (user_themes * 100) + user_pp;
  
  -- Count players with better scores
  SELECT COUNT(*) INTO better_count
  FROM user_progress
  WHERE (chapters_completed * 10) + (themes_completed * 100) + COALESCE(total_pp, 0) > user_score;
  
  RETURN better_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get leaderboard statistics
CREATE OR REPLACE FUNCTION get_leaderboard_stats()
RETURNS TABLE(
  total_players INTEGER,
  avg_chapters NUMERIC,
  top_score INTEGER,
  completion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_players,
    AVG(chapters_completed) as avg_chapters,
    MAX((chapters_completed * 10) + (themes_completed * 100) + COALESCE(total_pp, 0))::INTEGER as top_score,
    (COUNT(CASE WHEN themes_completed >= 7 THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) as completion_rate
  FROM user_progress;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_players_with_better_score(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_stats() TO anon, authenticated;
