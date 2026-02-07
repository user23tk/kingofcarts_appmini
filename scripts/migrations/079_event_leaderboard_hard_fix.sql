-- ============================================================
-- Script 079: Event Leaderboard Hard Fix
-- Scopo: fix trigger errato, bonifica RPC duplicati, GRANT, RLS
-- ============================================================

BEGIN;

-- A) Rimuovere trigger errato sulla tabella event_leaderboard
-- Motivo: il trigger scrive NEW.updated_at ma la tabella usa last_updated → ERROR 42703
DROP TRIGGER IF EXISTS update_event_leaderboard_updated_at ON public.event_leaderboard;

-- B) Bonifica overload ambigui per update_event_leaderboard_atomic
-- (idempotente: eseguire tutti i DROP; ignora quelli non esistenti)
DROP FUNCTION IF EXISTS public.update_event_leaderboard_atomic(TEXT, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_event_leaderboard_atomic(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_event_leaderboard_atomic(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.update_event_leaderboard_atomic(UUID, TEXT, INTEGER);

-- C) Ricreare UNICA versione coerente con schema (UUID, TEXT, INT)
-- e aggiungere controllo: aggiorna solo se il tema passato è un evento attivo in finestra temporale
CREATE OR REPLACE FUNCTION public.update_event_leaderboard_atomic(
  p_user_id uuid,
  p_theme text,
  p_pp_gained integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Consistency/safety: aggiornare solo se p_theme è l'evento attivo
  IF NOT EXISTS (
    SELECT 1
    FROM public.themes t
    WHERE t.name = p_theme
      AND t.is_event = true
      AND t.is_active = true
      AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
      AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
  ) THEN
    -- Non esegue nulla se tema non è evento attivo
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

-- D) GRANT (least-privilege)
-- Lettura: pubblico/anon va bene (solo read)
GRANT EXECUTE ON FUNCTION public.get_active_event() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_leaderboard_v2(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_event_stats(uuid, text) TO anon, authenticated, service_role;

-- Scrittura classifica: SOLO service_role (admin server). Niente anon.
REVOKE EXECUTE ON FUNCTION public.update_event_leaderboard_atomic(uuid, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_leaderboard_atomic(uuid, text, integer) TO service_role;

-- E) RLS: conferma stato (non modifichiamo le policy attuali; verifichiamo che RLS sia abilitato)
-- Nota: service_role bypassa RLS. Le policy esistenti consentono SELECT a public e INSERT/UPDATE ad authenticated.
-- Manteniamo le policy per retrocompatibilità, ma spostiamo l'update su RPC SECURITY DEFINER e GRANT solo a service_role.
ALTER TABLE public.event_leaderboard ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================
-- Test di verifica (eseguire manualmente dopo il commit)
-- ============================================================
-- SELECT * FROM public.get_active_event();
-- SELECT * FROM public.get_event_leaderboard_v2('natale', 10);
