-- Script: 110_fix_get_active_event_with_date_check.sql
-- Fix get_active_event to properly check event_start_date and event_end_date
-- This ensures events are only returned if they are within their valid date range

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS public.get_active_event();

-- Function: get_active_event
-- Returns the currently active event with proper date validation
CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  event_emoji text,
  pp_multiplier numeric,
  event_start_date timestamp with time zone,
  event_end_date timestamp with time zone,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First deactivate expired events
  PERFORM deactivate_expired_events();
  
  -- Return active event with date validation
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.event_emoji,
    t.pp_multiplier,
    t.event_start_date,
    t.event_end_date,
    t.is_active
  FROM themes t
  WHERE t.is_event = true
    AND t.is_active = true
    -- Only return events that have started
    AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
    -- Only return events that haven't ended
    AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
  ORDER BY t.event_start_date DESC
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_active_event() TO authenticated, anon;

-- Also update deactivate_expired_events to be more robust
DROP FUNCTION IF EXISTS public.deactivate_expired_events();

CREATE OR REPLACE FUNCTION deactivate_expired_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deactivated_count integer;
BEGIN
  -- Deactivate expired events
  WITH deactivated AS (
    UPDATE themes
    SET is_active = false
    WHERE is_event = true
      AND is_active = true
      AND event_end_date IS NOT NULL
      AND event_end_date < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deactivated_count FROM deactivated;
  
  -- Log if any events were deactivated
  IF v_deactivated_count > 0 THEN
    RAISE NOTICE 'Deactivated % expired event(s)', v_deactivated_count;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO authenticated, anon;
