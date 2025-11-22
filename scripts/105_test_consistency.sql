-- ============================================================================
-- TEST: VERIFICA CONSISTENZA DATI
-- Questo script verifica che tutti i dati siano consistenti dopo i fix
-- ============================================================================

-- Test 1: Verifica sincronizzazione campi duplicati
SELECT 
  '=== TEST 1: SINCRONIZZAZIONE CAMPI DUPLICATI ===' as test_section;

SELECT 
  user_id,
  chapters_completed,
  total_chapters_completed,
  CASE 
    WHEN chapters_completed = COALESCE(total_chapters_completed, chapters_completed) THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END as sync_status
FROM user_progress
WHERE chapters_completed != COALESCE(total_chapters_completed, chapters_completed)
ORDER BY user_id
LIMIT 10;

-- Riepilogo sincronizzazione capitoli
SELECT 
  'CHAPTERS SYNC SUMMARY' as summary_type,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE chapters_completed = COALESCE(total_chapters_completed, chapters_completed)) as synced_users,
  COUNT(*) FILTER (WHERE chapters_completed != COALESCE(total_chapters_completed, chapters_completed)) as unsynced_users
FROM user_progress;

-- Test 2: Verifica array temi vs contatore
SELECT 
  '=== TEST 2: ARRAY TEMI VS CONTATORE ===' as test_section;

SELECT 
  user_id,
  themes_completed,
  array_length(completed_themes, 1) as array_length,
  completed_themes,
  CASE 
    WHEN themes_completed = COALESCE(array_length(completed_themes, 1), 0) THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END as themes_status
FROM user_progress
WHERE themes_completed != COALESCE(array_length(completed_themes, 1), 0)
ORDER BY user_id
LIMIT 10;

-- Riepilogo sincronizzazione temi
SELECT 
  'THEMES SYNC SUMMARY' as summary_type,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE themes_completed = COALESCE(array_length(completed_themes, 1), 0)) as synced_users,
  COUNT(*) FILTER (WHERE themes_completed != COALESCE(array_length(completed_themes, 1), 0)) as unsynced_users
FROM user_progress;

-- Test 3: Verifica coerenza theme_progress JSONB
SELECT 
  '=== TEST 3: COERENZA THEME_PROGRESS JSONB ===' as test_section;

WITH theme_analysis AS (
  SELECT 
    user_id,
    themes_completed,
    (
      SELECT COUNT(*)
      FROM jsonb_each(theme_progress)
      WHERE (value->>'completed')::BOOLEAN = TRUE
    ) as jsonb_completed_themes,
    (
      SELECT COALESCE(SUM((value->>'chapters_completed')::INTEGER), 0)
      FROM jsonb_each(theme_progress)
    ) as jsonb_total_chapters
  FROM user_progress
  WHERE theme_progress IS NOT NULL AND theme_progress != '{}'::jsonb
)
SELECT 
  user_id,
  themes_completed,
  jsonb_completed_themes,
  jsonb_total_chapters,
  CASE 
    WHEN themes_completed = jsonb_completed_themes THEN '✅ THEMES OK'
    ELSE '❌ THEMES MISMATCH'
  END as themes_jsonb_status
FROM theme_analysis
WHERE themes_completed != jsonb_completed_themes
ORDER BY user_id
LIMIT 10;

-- Test 4: Verifica funzioni leaderboard
SELECT 
  '=== TEST 4: FUNZIONI LEADERBOARD ===' as test_section;

-- Test get_top_players
SELECT 
  'TOP 5 PLAYERS' as leaderboard_test,
  rank,
  user_id,
  username,
  chapters_completed,
  themes_completed,
  total_pp
FROM get_top_players(5);

-- Test get_user_rank con utente casuale
DO $$
DECLARE
  test_user_id UUID;
  user_rank_result RECORD;
BEGIN
  -- Prendi un utente casuale con progressi
  SELECT user_id INTO test_user_id
  FROM user_progress
  WHERE total_pp > 0 OR chapters_completed > 0
  ORDER BY RANDOM()
  LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    SELECT * INTO user_rank_result
    FROM get_user_rank(test_user_id);
    
    RAISE NOTICE 'USER RANK TEST - User: %, Rank: %, Total Players: %', 
      test_user_id, user_rank_result.rank, user_rank_result.total_players;
  END IF;
END $$;

-- Test 5: Statistiche generali
SELECT 
  '=== TEST 5: STATISTICHE GENERALI ===' as test_section;

SELECT 
  'GENERAL STATS' as stats_type,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE total_pp > 0) as users_with_pp,
  COUNT(*) FILTER (WHERE chapters_completed > 0) as users_with_chapters,
  COUNT(*) FILTER (WHERE themes_completed > 0) as users_with_themes,
  AVG(total_pp) as avg_pp,
  MAX(total_pp) as max_pp,
  AVG(chapters_completed) as avg_chapters,
  MAX(chapters_completed) as max_chapters
FROM user_progress;

-- Test 6: Verifica integrità referenziale
SELECT 
  '=== TEST 6: INTEGRITÀ REFERENZIALE ===' as test_section;

SELECT 
  'REFERENTIAL INTEGRITY' as integrity_test,
  COUNT(up.user_id) as progress_records,
  COUNT(u.id) as user_records,
  COUNT(up.user_id) - COUNT(u.id) as orphaned_progress
FROM user_progress up
LEFT JOIN users u ON u.id = up.user_id;

-- Test 7: Verifica trigger di sincronizzazione
SELECT 
  '=== TEST 7: TRIGGER SINCRONIZZAZIONE ===' as test_section;

SELECT 
  'TRIGGER STATUS' as trigger_test,
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_name = 'sync_duplicate_fields_trigger'
  AND event_object_table = 'user_progress';

-- Riepilogo finale
SELECT 
  '=== RIEPILOGO FINALE ===' as final_summary;

SELECT 
  'CONSISTENCY CHECK COMPLETED' as status,
  NOW() as check_time,
  'All tests completed - check results above' as message;
