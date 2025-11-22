-- Create get_active_event function to retrieve the currently active event
CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE (
  id uuid,
  theme text,
  event_name text,
  event_emoji text,
  pp_multiplier numeric,
  event_start_date timestamp with time zone,
  event_end_date timestamp with time zone,
  description text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name as theme,
    t.title as event_name,
    COALESCE(t.event_emoji, t.emoji) as event_emoji,
    COALESCE(t.pp_multiplier, 1.0) as pp_multiplier,
    t.event_start_date,
    t.event_end_date,
    t.description
  FROM themes t
  WHERE t.is_event = true 
    AND t.is_active = true
    AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
    AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
  ORDER BY t.event_start_date DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create deactivate_expired_events function to automatically deactivate past events
CREATE OR REPLACE FUNCTION deactivate_expired_events()
RETURNS void AS $$
BEGIN
  UPDATE themes
  SET is_active = false
  WHERE is_event = true 
    AND is_active = true
    AND event_end_date IS NOT NULL
    AND event_end_date <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_active_event() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO authenticated, anon;
