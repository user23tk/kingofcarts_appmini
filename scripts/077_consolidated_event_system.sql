-- ============================================================
-- SCRIPT 077: CONSOLIDATED EVENT SYSTEM
-- ============================================================
-- Implementa tutte le funzioni RPC per il sistema eventi:
-- DB-01: get_active_event
-- DB-02: get_event_leaderboard_v2
-- DB-03: get_user_event_stats
-- DB-04: update_event_leaderboard_atomic
-- DB-05: deactivate_expired_events
-- ============================================================

-- ============================================================
-- DB-01: get_active_event
-- Recupera l'evento attivo basato sulla tabella themes
-- ============================================================
DROP FUNCTION IF EXISTS get_active_event();

CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE (
  id UUID,
  name TEXT,
  title TEXT,
  description TEXT,
  emoji TEXT,
  event_emoji TEXT,
  pp_multiplier NUMERIC,
  event_start_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  is_active BOOLEAN
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

GRANT EXECUTE ON FUNCTION get_active_event() TO anon;
GRANT EXECUTE ON FUNCTION get_active_event() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_event() TO service_role;

-- ============================================================
-- DB-02: get_event_leaderboard_v2
-- Recupera la classifica evento con rank calcolato runtime
-- ============================================================
DROP FUNCTION IF EXISTS get_event_leaderboard_v2(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_event_leaderboard_v2(
  p_theme TEXT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  rank BIGINT,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.user_id,
    u.username,
    u.first_name,
    el.total_pp,
    el.chapters_completed,
    ROW_NUMBER() OVER (
      ORDER BY el.total_pp DESC, 
               el.chapters_completed DESC, 
               el.created_at ASC
    )::BIGINT as rank,
    el.last_updated
  FROM event_leaderboard el
  INNER JOIN users u ON el.user_id = u.id
  WHERE el.theme = p_theme 
    AND el.total_pp > 0
  ORDER BY el.total_pp DESC, 
           el.chapters_completed DESC, 
           el.created_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(TEXT, INTEGER) TO service_role;

-- ============================================================
-- DB-03: get_user_event_stats
-- Recupera le statistiche utente per un evento specifico
-- ============================================================
DROP FUNCTION IF EXISTS get_user_event_stats(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_user_event_stats(
  p_user_id UUID,
  p_theme TEXT
)
RETURNS TABLE (
  user_id UUID,
  theme TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  rank BIGINT,
  total_participants BIGINT,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_pp INTEGER;
  v_user_chapters INTEGER;
  v_user_created TIMESTAMPTZ;
  v_user_updated TIMESTAMPTZ;
  v_rank BIGINT;
  v_total BIGINT;
BEGIN
  -- Get user's stats
  SELECT el.total_pp, el.chapters_completed, el.created_at, el.last_updated
  INTO v_user_pp, v_user_chapters, v_user_created, v_user_updated
  FROM event_leaderboard el
  WHERE el.user_id = p_user_id AND el.theme = p_theme;
  
  -- If user not found, return null
  IF v_user_pp IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate rank
  SELECT COUNT(*) + 1 INTO v_rank
  FROM event_leaderboard el2
  WHERE el2.theme = p_theme
    AND el2.total_pp > 0
    AND (
      el2.total_pp > v_user_pp
      OR (el2.total_pp = v_user_pp AND el2.chapters_completed > v_user_chapters)
      OR (el2.total_pp = v_user_pp AND el2.chapters_completed = v_user_chapters AND el2.created_at < v_user_created)
    );
  
  -- Count total participants
  SELECT COUNT(*) INTO v_total
  FROM event_leaderboard el3
  WHERE el3.theme = p_theme AND el3.total_pp > 0;
  
  RETURN QUERY
  SELECT 
    p_user_id,
    p_theme,
    v_user_pp,
    v_user_chapters,
    v_rank,
    v_total,
    v_user_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_event_stats(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_event_stats(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_event_stats(UUID, TEXT) TO service_role;

-- ============================================================
-- DB-04: update_event_leaderboard_atomic
-- Aggiorna atomicamente la classifica evento (UPSERT)
-- Incrementa chapters_completed di 1 ad ogni chiamata
-- ============================================================
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION update_event_leaderboard_atomic(
  p_user_id UUID,
  p_theme TEXT,
  p_pp_gained INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Get the event_id for this theme (if exists)
  SELECT id INTO v_event_id
  FROM themes
  WHERE name = p_theme AND is_event = true
  LIMIT 1;

  -- Upsert into event_leaderboard
  INSERT INTO event_leaderboard (
    id,
    user_id,
    theme,
    event_id,
    total_pp,
    chapters_completed,
    created_at,
    last_updated
  )
  VALUES (
    gen_random_uuid(),
    p_user_id,
    p_theme,
    v_event_id,
    p_pp_gained,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, theme) DO UPDATE SET
    total_pp = event_leaderboard.total_pp + EXCLUDED.total_pp,
    chapters_completed = event_leaderboard.chapters_completed + 1,
    last_updated = NOW();
    
  RAISE NOTICE '[EVENT] Updated event_leaderboard: user=%, theme=%, pp_gained=%, new_total=%',
    p_user_id, p_theme, p_pp_gained, 
    (SELECT total_pp FROM event_leaderboard WHERE user_id = p_user_id AND theme = p_theme);
END;
$$;

GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(UUID, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(UUID, TEXT, INTEGER) TO service_role;

-- ============================================================
-- DB-05: deactivate_expired_events
-- Disattiva automaticamente gli eventi scaduti
-- ============================================================
DROP FUNCTION IF EXISTS deactivate_expired_events();

CREATE OR REPLACE FUNCTION deactivate_expired_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE themes
  SET is_active = false,
      updated_at = NOW()
  WHERE is_event = true
    AND is_active = true
    AND event_end_date IS NOT NULL
    AND event_end_date <= NOW();
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  IF v_count > 0 THEN
    RAISE NOTICE '[EVENT] Deactivated % expired event(s)', v_count;
  END IF;
  
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO anon;
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO service_role;

-- ============================================================
-- Ensure unique constraint exists for UPSERT
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_leaderboard_user_theme_unique'
  ) THEN
    ALTER TABLE event_leaderboard 
    ADD CONSTRAINT event_leaderboard_user_theme_unique 
    UNIQUE (user_id, theme);
    RAISE NOTICE 'Created unique constraint event_leaderboard_user_theme_unique';
  ELSE
    RAISE NOTICE 'Unique constraint event_leaderboard_user_theme_unique already exists';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint already exists, skipping';
END;
$$;

-- ============================================================
-- Verification queries (for testing)
-- ============================================================
-- SELECT * FROM get_active_event();
-- SELECT * FROM get_event_leaderboard_v2('natale', 10);
-- SELECT * FROM get_user_event_stats('user-uuid-here', 'natale');
