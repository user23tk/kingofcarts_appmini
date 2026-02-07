-- ============================================================================
-- Script 109: Fix Race Condition in Event System
-- ============================================================================
-- Issue: getActiveEvent() has race condition because it calls 
--        deactivate_expired_events() before get_active_event()
-- Solution: 
--   1. Fix date logic consistency (< vs <=)
--   2. Add pp_multiplier to get_active_event() return
--   3. Remove deactivate call from TypeScript code
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Fix deactivate_expired_events() - Use < NOW() instead of <= NOW()
-- ============================================================================
-- This ensures events expire AFTER end_date, not ON end_date

CREATE OR REPLACE FUNCTION deactivate_expired_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Changed from <= to < for consistency
    UPDATE themes
    SET is_active = false
    WHERE is_event = true 
      AND is_active = true 
      AND event_end_date < NOW();  -- Event expires AFTER end_date
      
    RAISE NOTICE 'Deactivated expired events';
END;
$$;

-- ============================================================================
-- 2. Fix get_active_event() - Add pp_multiplier to return
-- ============================================================================

DROP FUNCTION IF EXISTS get_active_event();

CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE(
    theme_id text,
    theme_name text,
    theme_description text,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    pp_multiplier numeric  -- Added pp_multiplier
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.name::TEXT as theme_id,
        t.title::TEXT as theme_name,
        t.description::TEXT as theme_description,
        t.event_start_date as start_date,
        t.event_end_date as end_date,
        t.pp_multiplier  -- Added pp_multiplier
    FROM themes t
    WHERE t.is_event = true 
      AND t.is_active = true 
      AND t.event_start_date <= NOW() 
      AND t.event_end_date > NOW()  -- Event active UNTIL end_date (exclusive)
    ORDER BY t.event_start_date DESC
    LIMIT 1;
END;
$$;

-- ============================================================================
-- 3. Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO anon;
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO service_role;

GRANT EXECUTE ON FUNCTION get_active_event() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_event() TO anon;
GRANT EXECUTE ON FUNCTION get_active_event() TO service_role;

COMMIT;

-- ============================================================================
-- 4. Test Queries
-- ============================================================================

-- Test 1: Get active event (should return natale with pp_multiplier)
SELECT 'Test 1: Get active event' as test;
SELECT * FROM get_active_event();

-- Test 2: Check current natale theme
SELECT 'Test 2: Current natale theme status' as test;
SELECT 
    name,
    is_active,
    is_event,
    event_start_date,
    event_end_date,
    pp_multiplier,
    NOW() as current_time,
    event_end_date > NOW() as is_still_active
FROM themes 
WHERE name = 'natale';

-- Test 3: Verify deactivate logic won't trigger yet
SELECT 'Test 3: Events that would be deactivated (should be empty)' as test;
SELECT 
    name,
    event_end_date,
    NOW() as current_time,
    event_end_date < NOW() as would_deactivate
FROM themes 
WHERE is_event = true 
  AND is_active = true 
  AND event_end_date < NOW();

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- Test 1: Should return:
--   theme_id: 'natale'
--   theme_name: 'Natale contest 2025'
--   pp_multiplier: 1.0 (or configured value)
--
-- Test 2: Should show:
--   is_active: true
--   is_still_active: true
--   pp_multiplier: visible value
--
-- Test 3: Should return empty (no events to deactivate yet)
-- ============================================================================
