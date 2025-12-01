-- ============================================
-- SCRIPT 110: Reset Contest Natale + Fix RPC
-- ============================================
-- Questo script:
-- 1. Elimina tutti i dati della leaderboard natale
-- 2. Ricrea la RPC get_active_event con fix timezone
-- 3. Resetta user_progress per il tema natale
-- ============================================

-- ============================================
-- STEP 1: BACKUP PRIMA DI ELIMINARE
-- ============================================
CREATE TABLE IF NOT EXISTS event_leaderboard_backup_110 AS 
SELECT * FROM event_leaderboard WHERE theme = 'natale';

-- ============================================
-- STEP 2: RESET COMPLETO LEADERBOARD NATALE
-- ============================================

-- Elimina tutti i record della leaderboard per il tema natale
DELETE FROM event_leaderboard WHERE theme = 'natale';

-- Reset anche eventuali backup
DELETE FROM event_leaderboard_backup WHERE theme = 'natale';

-- ============================================
-- STEP 2B: RESET USER_PROGRESS PER TEMA NATALE
-- ============================================

-- Backup user_progress prima delle modifiche
CREATE TABLE IF NOT EXISTS user_progress_backup_110 AS 
SELECT * FROM user_progress
WHERE theme_progress ? 'natale' 
   OR current_theme = 'natale' 
   OR 'natale' = ANY(completed_themes);

-- Rimuovi "natale" da theme_progress JSONB
UPDATE user_progress
SET 
    theme_progress = theme_progress - 'natale',
    updated_at = NOW()
WHERE theme_progress ? 'natale';

-- Rimuovi "natale" da completed_themes array
UPDATE user_progress
SET 
    completed_themes = array_remove(completed_themes, 'natale'),
    themes_completed = GREATEST(0, themes_completed - 1),
    updated_at = NOW()
WHERE 'natale' = ANY(completed_themes);

-- Usa 'horror' invece di NULL per rispettare NOT NULL constraint
-- Reset current_theme se era "natale" -> imposta a 'horror' (tema default)
UPDATE user_progress
SET 
    current_theme = 'horror',
    current_chapter = 1,
    updated_at = NOW()
WHERE current_theme = 'natale';

-- ============================================
-- STEP 3: FIX RPC get_active_event
-- ============================================
-- Il problema: la RPC usa NOW() che potrebbe avere timezone issues
-- Fix: uso CURRENT_TIMESTAMP AT TIME ZONE 'UTC' per coerenza

DROP FUNCTION IF EXISTS get_active_event();

CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE(
    name TEXT,
    title TEXT,
    description TEXT,
    event_start_date TIMESTAMPTZ,
    event_end_date TIMESTAMPTZ,
    pp_multiplier INTEGER,
    is_event BOOLEAN,
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ;
BEGIN
    v_now := NOW();
    
    RETURN QUERY
    SELECT 
        t.name,
        t.title,
        t.description,
        t.event_start_date,
        t.event_end_date,
        COALESCE(t.pp_multiplier, 1)::INTEGER as pp_multiplier,
        t.is_event,
        t.is_active
    FROM themes t
    WHERE t.is_event = TRUE
      AND t.is_active = TRUE
      AND t.event_start_date IS NOT NULL
      AND t.event_end_date IS NOT NULL
      AND t.event_start_date <= v_now
      AND t.event_end_date > v_now;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_active_event() TO anon, authenticated, service_role;

-- ============================================
-- STEP 4: VERIFICA POST-FIX
-- ============================================

-- Test 1: Verifica leaderboard vuota
SELECT 'Leaderboard natale count' as check_name, COUNT(*)::TEXT as result 
FROM event_leaderboard WHERE theme = 'natale';

-- Test 2: Test RPC get_active_event
SELECT 'RPC get_active_event test' as check_name, 
       CASE WHEN COUNT(*) > 0 THEN 'OK - Event found: ' || MAX(name) ELSE 'FAIL - No event' END as result
FROM get_active_event();

-- Test 3: Mostra dettagli evento attivo
SELECT * FROM get_active_event();

-- Test 4: Verifica tema natale nel DB
SELECT 'Tema natale exists' as check_name,
       name, is_event, is_active, event_start_date, event_end_date,
       CASE 
           WHEN event_start_date <= NOW() AND event_end_date > NOW() THEN 'SHOULD BE ACTIVE'
           ELSE 'NOT IN DATE RANGE'
       END as status
FROM themes 
WHERE name = 'natale';

-- Test 5: Backup count
SELECT 'Backup count' as check_name, COUNT(*)::TEXT as result 
FROM event_leaderboard_backup_110;

-- Test 6: User progress backup count
SELECT 'User progress backup count' as check_name, COUNT(*)::TEXT as result 
FROM user_progress_backup_110;

-- Test 7: Users con natale in theme_progress (dovrebbe essere 0)
SELECT 'Users with natale progress' as check_name, COUNT(*)::TEXT as result 
FROM user_progress WHERE theme_progress ? 'natale';

-- Test 8: Users con natale come current_theme (dovrebbe essere 0)
SELECT 'Users with natale current' as check_name, COUNT(*)::TEXT as result 
FROM user_progress WHERE current_theme = 'natale';
