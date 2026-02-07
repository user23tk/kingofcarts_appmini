-- Leaderboard functions
-- Query functions for top users and achievements

CREATE OR REPLACE FUNCTION get_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  rank BIGINT,
  telegram_id BIGINT,
  username TEXT,
  first_name TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY u.total_pp DESC, u.chapters_completed DESC) as rank,
    u.telegram_id,
    u.username,
    u.first_name,
    u.total_pp,
    u.chapters_completed
  FROM users u
  WHERE u.total_pp > 0
  ORDER BY u.total_pp DESC, u.chapters_completed DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_rank(user_telegram_id BIGINT)
RETURNS TABLE (
  rank BIGINT,
  total_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_users AS (
    SELECT 
      telegram_id,
      ROW_NUMBER() OVER (ORDER BY total_pp DESC, chapters_completed DESC) as user_rank
    FROM users
    WHERE total_pp > 0
  )
  SELECT 
    ru.user_rank as rank,
    (SELECT COUNT(*) FROM users WHERE total_pp > 0) as total_users
  FROM ranked_users ru
  WHERE ru.telegram_id = user_telegram_id;
END;
$$ LANGUAGE plpgsql;
