-- Script to add new RPC function for event leaderboard visibility (7 days after end)
-- This function returns events that are visible in leaderboard even after they ended

-- Function: get_event_for_leaderboard
-- Returns events that are either currently active OR ended within the last 7 days
CREATE OR REPLACE FUNCTION get_event_for_leaderboard()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  event_emoji text,
  pp_multiplier numeric,
  event_start_date timestamp with time zone,
  event_end_date timestamp with time zone,
  is_active boolean,
  status text  -- 'active' or 'closed_visible'
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.event_emoji,
    t.pp_multiplier,
    t.event_start_date,
    t.event_end_date,
    t.is_active,
    CASE 
      -- Event is currently active and within date range
      WHEN t.is_active = true 
           AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
           AND (t.event_end_date IS NULL OR t.event_end_date >= NOW())
      THEN 'active'::text
      -- Event has ended but within 7 days visibility window
      WHEN t.event_end_date IS NOT NULL 
           AND t.event_end_date < NOW() 
           AND t.event_end_date >= NOW() - INTERVAL '7 days'
      THEN 'closed_visible'::text
      ELSE NULL
    END as status
  FROM themes t
  WHERE t.is_event = true
    AND (
      -- Active event within date range
      (t.is_active = true 
       AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
       AND (t.event_end_date IS NULL OR t.event_end_date >= NOW()))
      OR
      -- Ended event within 7 days visibility window
      (t.event_end_date IS NOT NULL 
       AND t.event_end_date < NOW() 
       AND t.event_end_date >= NOW() - INTERVAL '7 days')
    )
  ORDER BY 
    -- Prioritize active events over closed ones
    CASE WHEN t.is_active = true AND (t.event_end_date IS NULL OR t.event_end_date >= NOW()) THEN 0 ELSE 1 END,
    t.event_end_date DESC NULLS LAST
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_event_for_leaderboard() TO authenticated, anon;
