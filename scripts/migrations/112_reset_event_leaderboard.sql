-- ============================================
-- SCRIPT 112: Reset Event Leaderboard (Generico)
-- ============================================
-- Questo script azzera la classifica e i progressi
-- per un evento tematico specifico (default: natale)
-- 
-- ISTRUZIONI: 
-- Cambia il valore di @theme_to_reset se vuoi
-- resettare un tema diverso da 'natale'
-- ============================================

-- ============================================
-- CONFIGURAZIONE: TEMA DA RESETTARE
-- ============================================
DO $$
DECLARE
    theme_to_reset TEXT := 'natale';  -- <-- CAMBIA QUI IL TEMA
    backup_suffix TEXT := to_char(NOW(), 'YYYYMMDD_HH24MI');
    leaderboard_count INTEGER;
    user_progress_count INTEGER;
BEGIN
    -- ============================================
    -- STEP 1: CONTEGGIO PRE-RESET
    -- ============================================
    SELECT COUNT(*) INTO leaderboard_count 
    FROM event_leaderboard WHERE theme = theme_to_reset;
    
    SELECT COUNT(*) INTO user_progress_count 
    FROM user_progress 
    WHERE theme_progress ? theme_to_reset 
       OR current_theme = theme_to_reset 
       OR theme_to_reset = ANY(completed_themes);
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'RESET EVENTO: %', theme_to_reset;
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Record leaderboard da eliminare: %', leaderboard_count;
    RAISE NOTICE 'User progress da modificare: %', user_progress_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- STEP 2: BACKUP LEADERBOARD
-- ============================================
-- Crea backup con timestamp per evitare conflitti
DROP TABLE IF EXISTS event_leaderboard_backup_112;
CREATE TABLE event_leaderboard_backup_112 AS 
SELECT 
    el.*,
    u.username,
    u.first_name,
    u.telegram_id,
    NOW() as backup_created_at
FROM event_leaderboard el
LEFT JOIN users u ON el.user_id = u.id
WHERE el.theme = 'natale';  -- <-- CAMBIA QUI IL TEMA

-- ============================================
-- STEP 3: BACKUP USER_PROGRESS
-- ============================================
DROP TABLE IF EXISTS user_progress_backup_112;
CREATE TABLE user_progress_backup_112 AS 
SELECT 
    up.*,
    u.username,
    u.first_name,
    u.telegram_id,
    NOW() as backup_created_at
FROM user_progress up
LEFT JOIN users u ON up.user_id = u.id
WHERE up.theme_progress ? 'natale'  -- <-- CAMBIA QUI IL TEMA
   OR up.current_theme = 'natale'   -- <-- CAMBIA QUI IL TEMA
   OR 'natale' = ANY(up.completed_themes);  -- <-- CAMBIA QUI IL TEMA

-- ============================================
-- STEP 4: ELIMINA LEADERBOARD
-- ============================================
DELETE FROM event_leaderboard WHERE theme = 'natale';  -- <-- CAMBIA QUI IL TEMA

-- Elimina anche eventuali backup precedenti per questo tema
DELETE FROM event_leaderboard_backup WHERE theme = 'natale';  -- <-- CAMBIA QUI IL TEMA

-- ============================================
-- STEP 5: RESET USER_PROGRESS
-- ============================================

-- Rimuovi il tema dal theme_progress JSONB
UPDATE user_progress
SET 
    theme_progress = theme_progress - 'natale',  -- <-- CAMBIA QUI IL TEMA
    updated_at = NOW()
WHERE theme_progress ? 'natale';  -- <-- CAMBIA QUI IL TEMA

-- Rimuovi il tema da completed_themes array
UPDATE user_progress
SET 
    completed_themes = array_remove(completed_themes, 'natale'),  -- <-- CAMBIA QUI IL TEMA
    themes_completed = GREATEST(0, themes_completed - 1),
    updated_at = NOW()
WHERE 'natale' = ANY(completed_themes);  -- <-- CAMBIA QUI IL TEMA

-- Reset current_theme se era il tema da resettare -> imposta a 'horror' (default)
UPDATE user_progress
SET 
    current_theme = 'horror',
    current_chapter = 1,
    updated_at = NOW()
WHERE current_theme = 'natale';  -- <-- CAMBIA QUI IL TEMA

-- ============================================
-- STEP 6: RESET PP_AUDIT PER IL TEMA (opzionale)
-- ============================================
-- Commenta questa sezione se vuoi mantenere lo storico audit
DELETE FROM pp_audit WHERE theme = 'natale';  -- <-- CAMBIA QUI IL TEMA

-- ============================================
-- STEP 7: VERIFICA POST-RESET
-- ============================================

-- Verifica 1: Leaderboard vuota
SELECT 
    'Leaderboard natale (post-reset)' as check_name, 
    COUNT(*)::TEXT as result 
FROM event_leaderboard 
WHERE theme = 'natale';  -- <-- CAMBIA QUI IL TEMA

-- Verifica 2: Backup creato
SELECT 
    'Backup leaderboard count' as check_name, 
    COUNT(*)::TEXT as result 
FROM event_leaderboard_backup_112;

-- Verifica 3: Backup user progress creato
SELECT 
    'Backup user_progress count' as check_name, 
    COUNT(*)::TEXT as result 
FROM user_progress_backup_112;

-- Verifica 4: Nessun utente con il tema in progress
SELECT 
    'Users con natale in theme_progress' as check_name, 
    COUNT(*)::TEXT as result 
FROM user_progress 
WHERE theme_progress ? 'natale';  -- <-- CAMBIA QUI IL TEMA

-- Verifica 5: Nessun utente con il tema come current
SELECT 
    'Users con natale come current_theme' as check_name, 
    COUNT(*)::TEXT as result 
FROM user_progress 
WHERE current_theme = 'natale';  -- <-- CAMBIA QUI IL TEMA

-- Verifica 6: Mostra top 5 del backup (per riferimento)
SELECT 
    'TOP 5 backup leaderboard' as info,
    username,
    first_name,
    total_pp,
    chapters_completed
FROM event_leaderboard_backup_112
ORDER BY total_pp DESC
LIMIT 5;

-- ============================================
-- MESSAGGIO FINALE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'RESET COMPLETATO!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'I backup sono salvati in:';
    RAISE NOTICE '  - event_leaderboard_backup_112';
    RAISE NOTICE '  - user_progress_backup_112';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Per vedere i backup:';
    RAISE NOTICE '  SELECT * FROM event_leaderboard_backup_112;';
    RAISE NOTICE '  SELECT * FROM user_progress_backup_112;';
    RAISE NOTICE '============================================';
END $$;
