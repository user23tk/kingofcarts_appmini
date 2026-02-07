-- Migration: Fix get_leaderboard rank calculation
-- Date: 2026-02-07
-- Description: Replaces the 'current_rank' column usage with dynamic ROW_NUMBER() calculation to ensure correct rankings.

DROP FUNCTION IF EXISTS public.get_leaderboard(integer);

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 100)
RETURNS TABLE (
  user_id uuid,
  username text,
  first_name text,
  photo_url text,
  total_chapters_completed integer,
  themes_completed integer,
  total_pp integer,
  current_rank bigint -- Changed to bigint to match ROW_NUMBER return type
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sub.user_id,
    sub.username,
    sub.first_name,
    sub.photo_url,
    sub.total_chapters_completed,
    sub.themes_completed,
    sub.total_pp,
    sub.rank as current_rank
  FROM (
    SELECT 
      up.user_id,
      u.username,
      u.first_name,
      u.photo_url,
      up.total_chapters_completed,
      up.themes_completed,
      up.total_pp,
      ROW_NUMBER() OVER (
        ORDER BY up.total_pp DESC, up.themes_completed DESC, up.total_chapters_completed DESC
      ) as rank
    FROM public.user_progress up
    JOIN public.users u ON u.id = up.user_id
    WHERE up.total_pp > 0
  ) sub
  LIMIT limit_count;
END;
$$;
