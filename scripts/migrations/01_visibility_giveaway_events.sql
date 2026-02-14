-- =====================================================
-- Migration: Visibilità Giveaway/Eventi Conclusi
-- Aggiorna le RPC per mostrare entità concluse
-- =====================================================
-- NOTA: Usa DROP FUNCTION per evitare errore
-- "cannot change return type of existing function"
-- =====================================================

-- ────────────────────────────────────────────────────
-- 1. get_active_giveaway_for_user
-- Ritorna il giveaway più recente dove is_active=true
-- Senza filtrare per ends_at (i conclusi restano visibili)
-- Aggiunge campo has_ended calcolato
-- ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_active_giveaway_for_user(UUID);

CREATE OR REPLACE FUNCTION public.get_active_giveaway_for_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giveaway JSONB;
  v_user_data JSONB;
  v_winner JSONB;
  v_giveaway_id UUID;
  v_onboarding_claimed BOOLEAN;
BEGIN
  -- Trova il giveaway più recente che l'admin non ha disattivato
  SELECT jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'description', g.description,
    'pp_per_ticket', g.pp_per_ticket,
    'tickets_per_entry', COALESCE(g.tickets_per_entry, 1),
    'starts_at', g.starts_at,
    'ends_at', g.ends_at,
    'is_active', g.is_active,
    'prize_title', g.prize_title,
    'prize_type', g.prize_type,
    'prize_description', g.prize_description,
    'prize_image_url', g.prize_image_url,
    'prize_link', g.prize_link,
    'has_ended', (g.ends_at < NOW()),
    'has_winner', EXISTS(SELECT 1 FROM giveaway_results gr WHERE gr.giveaway_id = g.id),
    'theme', CASE
      WHEN g.theme_id IS NOT NULL THEN (
        SELECT jsonb_build_object('id', t.id, 'name', t.name, 'title', t.title, 'emoji', COALESCE(t.event_emoji, t.emoji))
        FROM themes t WHERE t.id = g.theme_id
      )
      ELSE NULL
    END
  ) INTO v_giveaway
  FROM giveaways g
  WHERE g.is_active = true
  ORDER BY g.created_at DESC
  LIMIT 1;

  -- Se nessun giveaway trovato
  IF v_giveaway IS NULL THEN
    RETURN jsonb_build_object('giveaway', NULL, 'user_data', NULL, 'winner', NULL);
  END IF;

  v_giveaway_id := (v_giveaway->>'id')::UUID;

  -- Check onboarding_bonus (se la tabella esiste)
  v_onboarding_claimed := false;
  BEGIN
    SELECT COALESCE(up.onboarding_bonus_claimed, false)
    INTO v_onboarding_claimed
    FROM user_progress up
    WHERE up.user_id = p_user_id;
  EXCEPTION WHEN undefined_column THEN
    -- Fallback: prova tabella onboarding_bonus
    BEGIN
      SELECT COALESCE(ob.claimed, false) INTO v_onboarding_claimed
      FROM onboarding_bonus ob WHERE ob.user_id = p_user_id;
    EXCEPTION WHEN undefined_table THEN
      v_onboarding_claimed := false;
    END;
  END;

  -- Calcola dati utente (ticket, PP)
  SELECT jsonb_build_object(
    'total_pp', COALESCE(up.total_pp, 0),
    'pp_per_ticket', (v_giveaway->>'pp_per_ticket')::INTEGER,
    'tickets_total', CASE
      WHEN (v_giveaway->>'pp_per_ticket')::INTEGER > 0
      THEN FLOOR(COALESCE(up.total_pp, 0)::NUMERIC / (v_giveaway->>'pp_per_ticket')::INTEGER)
      ELSE 0
    END,
    'tickets_used', (SELECT COUNT(*) FROM giveaway_entries ge WHERE ge.giveaway_id = v_giveaway_id AND ge.user_id = p_user_id),
    'tickets_available', CASE
      WHEN (v_giveaway->>'pp_per_ticket')::INTEGER > 0
      THEN GREATEST(0, FLOOR(COALESCE(up.total_pp, 0)::NUMERIC / (v_giveaway->>'pp_per_ticket')::INTEGER) - (SELECT COUNT(*) FROM giveaway_entries ge WHERE ge.giveaway_id = v_giveaway_id AND ge.user_id = p_user_id))
      ELSE 0
    END,
    'pp_for_next_ticket', CASE
      WHEN (v_giveaway->>'pp_per_ticket')::INTEGER > 0
      THEN (v_giveaway->>'pp_per_ticket')::INTEGER - (COALESCE(up.total_pp, 0) % (v_giveaway->>'pp_per_ticket')::INTEGER)
      ELSE 0
    END,
    'ticket_numbers', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('ticket_number', ge.ticket_number, 'created_at', ge.created_at))
       FROM giveaway_entries ge
       WHERE ge.giveaway_id = v_giveaway_id AND ge.user_id = p_user_id
       ORDER BY ge.ticket_number),
      '[]'::jsonb
    ),
    'onboarding_bonus_claimed', v_onboarding_claimed
  ) INTO v_user_data
  FROM user_progress up
  WHERE up.user_id = p_user_id;

  -- Se utente non ancora registrato in user_progress
  IF v_user_data IS NULL THEN
    v_user_data := jsonb_build_object(
      'total_pp', 0,
      'pp_per_ticket', (v_giveaway->>'pp_per_ticket')::INTEGER,
      'tickets_total', 0,
      'tickets_used', 0,
      'tickets_available', 0,
      'pp_for_next_ticket', (v_giveaway->>'pp_per_ticket')::INTEGER,
      'ticket_numbers', '[]'::jsonb,
      'onboarding_bonus_claimed', false
    );
  END IF;

  -- Cerca vincitore se esiste
  SELECT jsonb_build_object(
    'user_id', gr.winner_user_id,
    'ticket_number', gr.winning_ticket_number,
    'username', u.username,
    'display_name', COALESCE(u.first_name, u.username, 'Anonimo'),
    'drawn_at', gr.drawn_at,
    'is_current_user', (gr.winner_user_id = p_user_id)
  ) INTO v_winner
  FROM giveaway_results gr
  JOIN users u ON u.id = gr.winner_user_id
  WHERE gr.giveaway_id = v_giveaway_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'giveaway', v_giveaway,
    'user_data', v_user_data,
    'winner', v_winner
  );
END;
$$;


-- ────────────────────────────────────────────────────
-- 2. get_active_event
-- IMPORTANTE: DROP obbligatorio perché il return type cambia
-- da (theme_id, theme_name, ...) a (name, title, has_ended, ...)
-- ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_active_event();

CREATE OR REPLACE FUNCTION public.get_active_event()
RETURNS TABLE (
  name TEXT,
  title TEXT,
  description TEXT,
  event_start_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  pp_multiplier NUMERIC,
  is_active BOOLEAN,
  is_event BOOLEAN,
  has_ended BOOLEAN,
  event_emoji TEXT,
  emoji TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.name,
    t.title,
    t.description,
    t.event_start_date,
    t.event_end_date,
    COALESCE(t.pp_multiplier, 1.0),
    t.is_active,
    t.is_event,
    CASE WHEN t.event_end_date IS NOT NULL AND t.event_end_date <= NOW() THEN true ELSE false END AS has_ended,
    COALESCE(t.event_emoji, t.emoji),
    t.emoji
  FROM themes t
  WHERE t.is_event = true
    AND t.is_active = true
  ORDER BY t.event_start_date DESC NULLS LAST
  LIMIT 1;
END;
$$;
