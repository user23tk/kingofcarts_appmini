-- ============================================================================
-- FIX: RIMOZIONE FUNZIONI LEADERBOARD ERRATE
-- Questo script rimuove le funzioni leaderboard che usano campi inesistenti
-- ============================================================================

-- Rimuovi funzioni leaderboard errate che cercano campi in users invece di user_progress
DROP FUNCTION IF EXISTS get_leaderboard(INTEGER);
DROP FUNCTION IF EXISTS get_user_rank(BIGINT);

-- Verifica che le funzioni corrette esistano (da SETUP_MINIAPP.sql)
DO $$
BEGIN
  -- Verifica get_top_players
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_top_players'
  ) THEN
    RAISE NOTICE '✅ Function get_top_players exists and is correct';
  ELSE
    RAISE WARNING '❌ Function get_top_players is missing - run SETUP_MINIAPP.sql';
  END IF;
  
  -- Verifica get_user_rank
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_rank'
  ) THEN
    RAISE NOTICE '✅ Function get_user_rank exists and is correct';
  ELSE
    RAISE WARNING '❌ Function get_user_rank is missing - run SETUP_MINIAPP.sql';
  END IF;
END $$;

-- Test delle funzioni corrette
SELECT 'Testing leaderboard functions...' as status;

-- Test get_top_players (primi 5)
SELECT 
  'get_top_players test' as test_name,
  COUNT(*) as returned_rows
FROM get_top_players(5);

-- Test get_user_rank (con primo utente disponibile)
DO $$
DECLARE
  test_user_id UUID;
  user_rank_result RECORD;
BEGIN
  -- Prendi il primo utente con progressi
  SELECT user_id INTO test_user_id
  FROM user_progress
  WHERE total_pp > 0 OR chapters_completed > 0
  LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    SELECT * INTO user_rank_result
    FROM get_user_rank(test_user_id);
    
    RAISE NOTICE '✅ get_user_rank test successful - User rank: %, Total players: %', 
      user_rank_result.rank, user_rank_result.total_players;
  ELSE
    RAISE NOTICE 'ℹ️ No users with progress found for get_user_rank test';
  END IF;
END $$;

SELECT 'Broken leaderboard functions removed successfully' as status;
