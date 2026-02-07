-- ============================================================================
-- Script 106: EVENT LEADERBOARD FINAL FIX
-- Scopo: Verifica e crea RPC mancanti, allinea dati, fix security
-- Data: 2025-01-12
-- ============================================================================

BEGIN;

-- ============================================================================
-- PARTE 1: DIAGNOSTICA - Verifica stato attuale funzioni RPC
-- ============================================================================

DO $$
DECLARE
  func_exists BOOLEAN;
BEGIN
  -- Check get_event_leaderboard_v2
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_event_leaderboard_v2'
  ) INTO func_exists;
  
  IF func_exists THEN
    RAISE NOTICE '✅ get_event_leaderboard_v2 EXISTS';
  ELSE
    RAISE NOTICE '❌ get_event_leaderboard_v2 MISSING - will create';
  END IF;
  
  -- Check update_event_leaderboard_atomic
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_event_leaderboard_atomic'
  ) INTO func_exists;
  
  IF func_exists THEN
    RAISE NOTICE '✅ update_event_leaderboard_atomic EXISTS';
  ELSE
    RAISE NOTICE '❌ update_event_leaderboard_atomic MISSING - will create';
  END IF;
  
  -- Check get_active_event
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_active_event'
  ) INTO func_exists;
  
  IF func_exists THEN
    RAISE NOTICE '✅ get_active_event EXISTS';
  ELSE
    RAISE NOTICE '❌ get_active_event MISSING - will create';
  END IF;
END $$;

-- ============================================================================
-- PARTE 2: CREAZIONE/AGGIORNAMENTO FUNZIONI RPC
-- ============================================================================

-- 2A) get_event_leaderboard_v2 - Leaderboard con ordinamento PP-first
CREATE OR REPLACE FUNCTION public.get_event_leaderboard_v2(
  p_theme TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  telegram_id BIGINT,
  first_name TEXT,
  username TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY el.total_pp DESC, el.chapters_completed DESC)::BIGINT as rank,
    el.user_id,
    u.telegram_id,
    u.first_name,
    u.username,
    el.total_pp,
    el.chapters_completed,
    el.last_updated
  FROM public.event_leaderboard el
  JOIN public.users u ON u.id = el.user_id
  WHERE el.theme = p_theme
  ORDER BY el.total_pp DESC, el.chapters_completed DESC
  LIMIT p_limit;
END;
$function$;

-- 2B) get_active_event - Ritorna evento attivo corrente
CREATE OR REPLACE FUNCTION public.get_active_event()
RETURNS TABLE (
  id UUID,
  name TEXT,
  title TEXT,
  description TEXT,
  emoji TEXT,
  event_emoji TEXT,
  pp_multiplier NUMERIC,
  event_start_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.title,
    t.description,
    t.emoji,
    t.event_emoji,
    t.pp_multiplier,
    t.event_start_date,
    t.event_end_date
  FROM public.themes t
  WHERE t.is_event = true
    AND t.is_active = true
    AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
    AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
  ORDER BY t.event_start_date DESC
  LIMIT 1;
END;
$function$;

-- 2C) update_event_leaderboard_atomic - Aggiornamento atomico leaderboard
CREATE OR REPLACE FUNCTION public.update_event_leaderboard_atomic(
  p_user_id UUID,
  p_theme TEXT,
  p_pp_gained INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Safety check: aggiorna solo se p_theme è evento attivo
  IF NOT EXISTS (
    SELECT 1
    FROM public.themes t
    WHERE t.name = p_theme
      AND t.is_event = true
      AND t.is_active = true
      AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
      AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.event_leaderboard (user_id, theme, total_pp, chapters_completed, last_updated)
  VALUES (p_user_id, p_theme, p_pp_gained, 1, NOW())
  ON CONFLICT (user_id, theme)
  DO UPDATE SET
    total_pp = public.event_leaderboard.total_pp + p_pp_gained,
    chapters_completed = public.event_leaderboard.chapters_completed + 1,
    last_updated = NOW();
END;
$function$;

-- 2D) get_user_event_stats - Statistiche utente per evento
CREATE OR REPLACE FUNCTION public.get_user_event_stats(
  p_user_id UUID,
  p_theme TEXT
)
RETURNS TABLE (
  user_id UUID,
  theme TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  rank BIGINT,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT 
      el.user_id,
      el.theme,
      el.total_pp,
      el.chapters_completed,
      el.last_updated,
      ROW_NUMBER() OVER (ORDER BY el.total_pp DESC, el.chapters_completed DESC)::BIGINT as rank
    FROM public.event_leaderboard el
    WHERE el.theme = p_theme
  )
  SELECT 
    r.user_id,
    r.theme,
    r.total_pp,
    r.chapters_completed,
    r.rank,
    r.last_updated
  FROM ranked r
  WHERE r.user_id = p_user_id;
END;
$function$;

-- ============================================================================
-- PARTE 3: GRANT PERMISSIONS
-- ============================================================================

-- Lettura: pubblico
GRANT EXECUTE ON FUNCTION public.get_active_event() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_leaderboard_v2(TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_event_stats(UUID, TEXT) TO anon, authenticated, service_role;

-- Scrittura: solo service_role (backend)
REVOKE EXECUTE ON FUNCTION public.update_event_leaderboard_atomic(UUID, TEXT, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_leaderboard_atomic(UUID, TEXT, INTEGER) TO service_role;

-- ============================================================================
-- PARTE 4: FIX RLS TABELLE BACKUP
-- ============================================================================

ALTER TABLE public.event_leaderboard_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress_backup ENABLE ROW LEVEL SECURITY;

-- Policy per backup: solo service_role
DROP POLICY IF EXISTS backup_service_only ON public.event_leaderboard_backup;
CREATE POLICY backup_service_only ON public.event_leaderboard_backup
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS progress_backup_service_only ON public.user_progress_backup;
CREATE POLICY progress_backup_service_only ON public.user_progress_backup
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- PARTE 5: VERIFICA CONSTRAINT UNIQUE
-- ============================================================================

-- Assicura constraint unique per event_leaderboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_leaderboard_user_theme_unique'
  ) THEN
    ALTER TABLE public.event_leaderboard 
    ADD CONSTRAINT event_leaderboard_user_theme_unique 
    UNIQUE (user_id, theme);
    RAISE NOTICE '✅ Added unique constraint event_leaderboard_user_theme_unique';
  ELSE
    RAISE NOTICE '✅ Constraint event_leaderboard_user_theme_unique already exists';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE '✅ Constraint already exists (duplicate_object)';
  WHEN unique_violation THEN
    RAISE NOTICE '⚠️ Cannot add constraint - duplicate data exists. Run cleanup first.';
END $$;

COMMIT;

-- ============================================================================
-- PARTE 6: DIAGNOSTICA POST-FIX (eseguire dopo COMMIT)
-- ============================================================================

-- Test get_active_event
SELECT '=== TEST get_active_event ===' as test;
SELECT * FROM public.get_active_event();

-- Test get_event_leaderboard_v2 (sostituisci 'natale' con il tema attivo)
SELECT '=== TEST get_event_leaderboard_v2 ===' as test;
SELECT * FROM public.get_event_leaderboard_v2('natale', 10);

-- Conteggio record per tema
SELECT '=== RECORD COUNT PER THEME ===' as test;
SELECT 
  theme,
  COUNT(*) as total_entries,
  SUM(total_pp) as sum_pp,
  MAX(total_pp) as max_pp
FROM public.event_leaderboard
GROUP BY theme;

-- Verifica funzioni create
SELECT '=== FUNZIONI RPC EVENTO ===' as test;
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('get_event_leaderboard_v2', 'get_active_event', 'update_event_leaderboard_atomic', 'get_user_event_stats')
ORDER BY p.proname;
