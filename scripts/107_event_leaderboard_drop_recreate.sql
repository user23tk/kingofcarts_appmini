-- Script 107: Drop and recreate event leaderboard functions
-- This script safely drops existing functions before recreating them

BEGIN;

-- =====================================================
-- 1. DROP EXISTING FUNCTIONS (safe - no data loss)
-- =====================================================

DROP FUNCTION IF EXISTS get_event_leaderboard_v2(text, integer);
DROP FUNCTION IF EXISTS get_active_event();
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(bigint, text, integer, integer);
DROP FUNCTION IF EXISTS get_user_event_stats(bigint, text);

-- =====================================================
-- 2. CREATE get_event_leaderboard_v2
-- =====================================================

CREATE OR REPLACE FUNCTION get_event_leaderboard_v2(
    p_theme TEXT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    user_id BIGINT,
    telegram_id BIGINT,
    first_name TEXT,
    username TEXT,
    total_pp INTEGER,
    chapters_completed INTEGER,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        el.user_id,
        u.telegram_id,
        u.first_name,
        u.username,
        el.total_pp,
        el.chapters_completed,
        ROW_NUMBER() OVER (ORDER BY el.total_pp DESC, el.chapters_completed DESC) as rank
    FROM event_leaderboard el
    JOIN users u ON el.user_id = u.id
    WHERE el.theme = p_theme
    ORDER BY el.total_pp DESC, el.chapters_completed DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. CREATE get_active_event
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE (
    theme_id TEXT,
    theme_name TEXT,
    theme_description TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id::TEXT as theme_id,
        t.name as theme_name,
        t.description as theme_description,
        t.event_start_date as start_date,
        t.event_end_date as end_date
    FROM themes t
    WHERE t.is_event = true
      AND t.event_start_date <= NOW()
      AND t.event_end_date >= NOW()
    ORDER BY t.event_start_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. CREATE update_event_leaderboard_atomic
-- =====================================================

CREATE OR REPLACE FUNCTION update_event_leaderboard_atomic(
    p_user_id BIGINT,
    p_theme TEXT,
    p_pp_earned INTEGER,
    p_chapters INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO event_leaderboard (user_id, theme, total_pp, chapters_completed, last_updated)
    VALUES (p_user_id, p_theme, p_pp_earned, p_chapters, NOW())
    ON CONFLICT (user_id, theme) 
    DO UPDATE SET 
        total_pp = event_leaderboard.total_pp + p_pp_earned,
        chapters_completed = event_leaderboard.chapters_completed + p_chapters,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CREATE get_user_event_stats
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_event_stats(
    p_user_id BIGINT,
    p_theme TEXT
)
RETURNS TABLE (
    total_pp INTEGER,
    chapters_completed INTEGER,
    rank BIGINT,
    total_participants BIGINT
) AS $$
DECLARE
    v_user_rank BIGINT;
    v_total BIGINT;
BEGIN
    -- Get user rank
    SELECT COUNT(*) + 1 INTO v_user_rank
    FROM event_leaderboard el
    WHERE el.theme = p_theme
      AND (el.total_pp > (SELECT COALESCE(el2.total_pp, 0) FROM event_leaderboard el2 WHERE el2.user_id = p_user_id AND el2.theme = p_theme));
    
    -- Get total participants
    SELECT COUNT(*) INTO v_total FROM event_leaderboard WHERE theme = p_theme;
    
    RETURN QUERY
    SELECT 
        COALESCE(el.total_pp, 0) as total_pp,
        COALESCE(el.chapters_completed, 0) as chapters_completed,
        COALESCE(v_user_rank, v_total + 1) as rank,
        v_total as total_participants
    FROM event_leaderboard el
    WHERE el.user_id = p_user_id AND el.theme = p_theme
    UNION ALL
    SELECT 0, 0, v_total + 1, v_total
    WHERE NOT EXISTS (SELECT 1 FROM event_leaderboard WHERE user_id = p_user_id AND theme = p_theme)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(text, integer) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_active_event() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(bigint, text, integer, integer) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_event_stats(bigint, text) TO authenticated, anon, service_role;

COMMIT;

-- =====================================================
-- 7. VERIFICATION (run after commit)
-- =====================================================

SELECT 'Functions created:' as status;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_event_leaderboard_v2', 'get_active_event', 'update_event_leaderboard_atomic', 'get_user_event_stats');

-- Test get_event_leaderboard_v2
SELECT 'Testing get_event_leaderboard_v2:' as status;
SELECT * FROM get_event_leaderboard_v2('news', 5);

-- Show current event leaderboard data
SELECT 'Current event_leaderboard data:' as status;
SELECT * FROM event_leaderboard ORDER BY total_pp DESC LIMIT 10;
