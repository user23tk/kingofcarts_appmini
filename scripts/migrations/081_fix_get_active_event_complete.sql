-- ============================================================
-- FIX COMPLETO: Contest Leaderboard - get_active_event() RPC
-- Issue: RPC ritorna array vuoto al backend ma funziona in SQL console
-- Root cause: Permessi GRANT mancanti o funzione non deployata correttamente
-- ============================================================

-- STEP 1: Drop TUTTE le versioni esistenti per evitare conflitti
DROP FUNCTION IF EXISTS public.get_active_event() CASCADE;
DROP FUNCTION IF EXISTS public.get_active_event(text) CASCADE;

-- STEP 2: Ricrea deactivate_expired_events (prerequisito)
DROP FUNCTION IF EXISTS public.deactivate_expired_events() CASCADE;

CREATE OR REPLACE FUNCTION public.deactivate_expired_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE themes
  SET is_active = false
  WHERE is_event = true
    AND is_active = true
    AND event_end_date IS NOT NULL
    AND event_end_date <= NOW();
END;
$$;

-- Grant permissions per deactivate_expired_events
GRANT EXECUTE ON FUNCTION public.deactivate_expired_events() TO anon;
GRANT EXECUTE ON FUNCTION public.deactivate_expired_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_expired_events() TO service_role;

-- STEP 3: Ricrea get_active_event con la signature corretta
CREATE OR REPLACE FUNCTION public.get_active_event()
RETURNS TABLE(
  id uuid,
  name text,
  title text,
  description text,
  emoji text,
  event_emoji text,
  pp_multiplier numeric,
  event_start_date timestamp with time zone,
  event_end_date timestamp with time zone,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    t.event_end_date,
    t.is_active
  FROM themes t
  WHERE t.is_event = true
    AND t.is_active = true
    AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
    AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
  ORDER BY t.event_start_date DESC NULLS LAST
  LIMIT 1;
END;
$$;

-- STEP 4: Grant permissions - CRUCIALE per il funzionamento da JS client
GRANT EXECUTE ON FUNCTION public.get_active_event() TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_event() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_event() TO service_role;

-- STEP 5: Assicura che la tabella themes sia accessibile
GRANT SELECT ON public.themes TO anon;
GRANT SELECT ON public.themes TO authenticated;
GRANT SELECT ON public.themes TO service_role;
GRANT ALL ON public.themes TO service_role;

-- STEP 6: Verifica che event_leaderboard sia accessibile
GRANT SELECT ON public.event_leaderboard TO anon;
GRANT SELECT ON public.event_leaderboard TO authenticated;
GRANT ALL ON public.event_leaderboard TO service_role;

-- STEP 7: Ricrea get_event_leaderboard_v2 per sicurezza
DROP FUNCTION IF EXISTS public.get_event_leaderboard_v2(text, integer) CASCADE;

CREATE OR REPLACE FUNCTION public.get_event_leaderboard_v2(
  p_theme text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  rank bigint,
  user_id uuid,
  username text,
  first_name text,
  total_pp integer,
  chapters_completed integer,
  last_updated timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY el.total_pp DESC, el.chapters_completed DESC) as rank,
    el.user_id,
    u.username,
    u.first_name,
    el.total_pp,
    el.chapters_completed,
    el.last_updated
  FROM event_leaderboard el
  INNER JOIN users u ON el.user_id = u.id
  WHERE el.theme = p_theme
    AND el.total_pp > 0
  ORDER BY el.total_pp DESC, el.chapters_completed DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_leaderboard_v2(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_leaderboard_v2(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_leaderboard_v2(text, integer) TO service_role;

-- STEP 8: Aggiorna update_event_leaderboard_atomic
DROP FUNCTION IF EXISTS public.update_event_leaderboard_atomic(uuid, text, integer) CASCADE;

CREATE OR REPLACE FUNCTION public.update_event_leaderboard_atomic(
  p_user_id uuid,
  p_theme text,
  p_pp_gained integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO event_leaderboard (user_id, theme, total_pp, chapters_completed, last_updated)
  VALUES (p_user_id, p_theme, p_pp_gained, 1, NOW())
  ON CONFLICT (user_id, theme)
  DO UPDATE SET
    total_pp = event_leaderboard.total_pp + p_pp_gained,
    chapters_completed = event_leaderboard.chapters_completed + 1,
    last_updated = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_event_leaderboard_atomic(uuid, text, integer) TO service_role;

-- STEP 9: Commento documentazione
COMMENT ON FUNCTION public.get_active_event() IS 
'Returns the currently active event/contest theme. Validates is_event=true, is_active=true, and date range. Used by contest leaderboard.';

-- STEP 10: Test della funzione (verifica output)
SELECT 'Testing get_active_event()' as step;
SELECT * FROM public.get_active_event();
