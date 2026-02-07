-- ============================================================
-- SCRIPT 078: DEBUG AND FIX EVENT SYSTEM
-- ============================================================
-- Diagnostica e correzione del sistema evento/classifica contest
-- ============================================================

-- 1. Verifica stato evento attivo
SELECT '=== ACTIVE EVENT CHECK ===' as section;
SELECT 
  id,
  name,
  title,
  is_event,
  is_active,
  pp_multiplier,
  event_start_date,
  event_end_date,
  CASE 
    WHEN event_start_date IS NULL OR event_start_date <= NOW() THEN 'Started'
    ELSE 'Not Started'
  END as start_status,
  CASE 
    WHEN event_end_date IS NULL OR event_end_date > NOW() THEN 'Active'
    ELSE 'Expired'
  END as end_status
FROM themes 
WHERE is_event = true;

-- 2. Verifica contenuto event_leaderboard
SELECT '=== EVENT_LEADERBOARD CONTENT ===' as section;
SELECT 
  el.user_id,
  el.theme,
  el.total_pp,
  el.chapters_completed,
  el.created_at,
  el.last_updated,
  u.first_name,
  u.username
FROM event_leaderboard el
LEFT JOIN users u ON el.user_id = u.id
ORDER BY el.total_pp DESC
LIMIT 20;

-- 3. Verifica che get_active_event funzioni
SELECT '=== GET_ACTIVE_EVENT TEST ===' as section;
SELECT * FROM get_active_event();

-- 4. Verifica che get_event_leaderboard_v2 funzioni
SELECT '=== GET_EVENT_LEADERBOARD_V2 TEST ===' as section;
SELECT * FROM get_event_leaderboard_v2('natale', 10);

-- 5. Confronto tra user_progress e event_leaderboard
-- Trova utenti che hanno giocato al tema evento ma non sono in event_leaderboard
SELECT '=== USERS MISSING FROM EVENT_LEADERBOARD ===' as section;
SELECT 
  up.user_id,
  up.total_pp as user_progress_pp,
  up.chapters_completed,
  up.theme_progress,
  u.first_name
FROM user_progress up
JOIN users u ON up.user_id = u.id
WHERE up.theme_progress::text LIKE '%natale%'
  AND NOT EXISTS (
    SELECT 1 FROM event_leaderboard el 
    WHERE el.user_id = up.user_id AND el.theme = 'natale'
  );

-- 6. Fix: Inserisci utenti mancanti in event_leaderboard
-- Estrae i PP del tema specifico da theme_progress JSONB
SELECT '=== FIXING MISSING ENTRIES ===' as section;

INSERT INTO event_leaderboard (id, user_id, theme, total_pp, chapters_completed, created_at, last_updated)
SELECT 
  gen_random_uuid(),
  up.user_id,
  'natale',
  COALESCE(
    (up.theme_progress->'natale'->>'total_pp')::INTEGER,
    CASE 
      WHEN (up.theme_progress->'natale'->>'current_chapter')::INTEGER > 1 
      THEN ((up.theme_progress->'natale'->>'current_chapter')::INTEGER - 1) * 100
      ELSE 0
    END
  ),
  GREATEST(1, COALESCE((up.theme_progress->'natale'->>'current_chapter')::INTEGER - 1, 0)),
  NOW(),
  NOW()
FROM user_progress up
WHERE up.theme_progress::text LIKE '%natale%'
  AND (up.theme_progress->'natale'->>'current_chapter')::INTEGER > 1
  AND NOT EXISTS (
    SELECT 1 FROM event_leaderboard el 
    WHERE el.user_id = up.user_id AND el.theme = 'natale'
  )
ON CONFLICT (user_id, theme) DO NOTHING;

-- 7. Verifica risultato fix
SELECT '=== VERIFICATION AFTER FIX ===' as section;
SELECT * FROM get_event_leaderboard_v2('natale', 20);

-- 8. Count finale
SELECT '=== FINAL COUNTS ===' as section;
SELECT 
  (SELECT COUNT(*) FROM event_leaderboard WHERE theme = 'natale') as event_leaderboard_count,
  (SELECT COUNT(*) FROM user_progress WHERE theme_progress::text LIKE '%natale%') as users_played_theme;
