-- Migration: Update get_leaderboard RPC to include first_name and themes_completed
-- Date: 2026-02-07

DROP FUNCTION IF EXISTS public.get_leaderboard(integer);

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 100)
RETURNS TABLE (
  user_id uuid,
  username text,
  first_name text, -- Added
  photo_url text,
  total_chapters_completed integer,
  themes_completed integer, -- Added
  total_pp integer,
  current_rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    u.username,
    u.first_name, -- Added
    u.photo_url,
    up.total_chapters_completed,
    up.themes_completed, -- Added
    up.total_pp,
    up.current_rank
  FROM public.user_progress up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.total_pp > 0 -- Only rank users with points
  ORDER BY up.total_pp DESC, up.total_chapters_completed DESC
  LIMIT limit_count;
END;
$$;
