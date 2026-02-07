-- SCRIPT FINALE: Allineamento completo sistema eventi per produzione
-- Questo script sostituisce e corregge gli script 019, 020, 021

-- ============================================================================
-- STEP 1: DROP tutte le funzioni esistenti per evitare conflitti
-- ============================================================================
DROP FUNCTION IF EXISTS get_active_event();
DROP FUNCTION IF EXISTS get_event_leaderboard(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_user_event_rank(TEXT, TEXT);
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(TEXT, UUID, INTEGER);
DROP FUNCTION IF EXISTS complete_chapter_atomic(TEXT, TEXT, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS complete_chapter_atomic(TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS deactivate_expired_events();

-- ============================================================================
-- STEP 2: Verifica e allinea schema tabella event_leaderboard
-- ============================================================================
-- La tabella event_leaderboard usa 'theme' (TEXT) non 'theme_id' (UUID)
-- Questo è corretto perché gli eventi usano il campo 'name' della tabella themes come chiave

-- Verifica che la tabella abbia le colonne corrette
DO $$ 
BEGIN
  -- Assicurati che esista la constraint unique
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_leaderboard_user_id_theme_key'
  ) THEN
    ALTER TABLE event_leaderboard 
    ADD CONSTRAINT event_leaderboard_user_id_theme_key UNIQUE (user_id, theme);
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Crea funzione per disattivare eventi scaduti
-- ============================================================================
CREATE FUNCTION deactivate_expired_events()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE themes
  SET is_active = false, updated_at = NOW()
  WHERE is_event = true 
    AND is_active = true
    AND event_end_date IS NOT NULL
    AND event_end_date <= NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Crea funzione per ottenere evento attivo
-- ============================================================================
CREATE FUNCTION get_active_event()
RETURNS TABLE (
  id UUID,
  name TEXT,
  title TEXT,
  description TEXT,
  event_emoji TEXT,
  event_start_date TIMESTAMP WITH TIME ZONE,
  event_end_date TIMESTAMP WITH TIME ZONE,
  pp_multiplier NUMERIC,
  is_active BOOLEAN
) AS $$
BEGIN
  -- Prima disattiva eventi scaduti
  PERFORM deactivate_expired_events();
  
  -- Poi restituisci l'evento attivo
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.title,
    t.description,
    t.event_emoji,
    t.event_start_date,
    t.event_end_date,
    t.pp_multiplier,
    t.is_active
  FROM themes t
  WHERE t.is_event = true 
    AND t.is_active = true
    AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
  ORDER BY t.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Crea funzione per aggiornare classifica eventi atomicamente
-- ============================================================================
CREATE FUNCTION update_event_leaderboard_atomic(
  p_user_id TEXT,
  p_theme TEXT,
  p_pp_gained INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Insert or update con locking automatico tramite ON CONFLICT
  INSERT INTO event_leaderboard (user_id, theme, total_pp, chapters_completed, last_updated)
  VALUES (p_user_id, p_theme, p_pp_gained, 1, NOW())
  ON CONFLICT (user_id, theme) 
  DO UPDATE SET
    total_pp = event_leaderboard.total_pp + p_pp_gained,
    chapters_completed = event_leaderboard.chapters_completed + 1,
    last_updated = NOW()
  WHERE event_leaderboard.user_id = p_user_id 
    AND event_leaderboard.theme = p_theme;
    
  -- Aggiorna il rank dopo l'update
  UPDATE event_leaderboard el
  SET rank = subquery.new_rank
  FROM (
    SELECT 
      user_id,
      theme,
      ROW_NUMBER() OVER (PARTITION BY theme ORDER BY total_pp DESC, last_updated ASC) as new_rank
    FROM event_leaderboard
    WHERE theme = p_theme
  ) AS subquery
  WHERE el.user_id = subquery.user_id 
    AND el.theme = subquery.theme;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Crea funzione per completare capitolo atomicamente
-- ============================================================================
CREATE FUNCTION complete_chapter_atomic(
  p_user_id TEXT,
  p_theme_key TEXT,
  p_chapter_number INTEGER,
  p_pp_gained INTEGER,
  p_is_event BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_new_total_pp INTEGER;
  v_progress_id UUID;
  v_user_uuid UUID;
BEGIN
  -- Convert user_id to UUID se necessario
  BEGIN
    v_user_uuid := p_user_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    -- Se la conversione fallisce, cerca l'utente per telegram_id
    SELECT id INTO v_user_uuid FROM users WHERE telegram_id = p_user_id::BIGINT;
    IF v_user_uuid IS NULL THEN
      RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;
  END;
  
  -- Lock e update user_progress
  SELECT id INTO v_progress_id
  FROM user_progress
  WHERE user_id = v_user_uuid AND current_theme = p_theme_key
  FOR UPDATE;
  
  IF v_progress_id IS NULL THEN
    RAISE EXCEPTION 'User progress not found for user % and theme %', p_user_id, p_theme_key;
  END IF;
  
  UPDATE user_progress
  SET 
    current_chapter = p_chapter_number + 1,
    total_pp = COALESCE(total_pp, 0) + p_pp_gained,
    total_chapters_completed = COALESCE(total_chapters_completed, 0) + 1,
    last_interaction = NOW(),
    updated_at = NOW()
  WHERE user_id = v_user_uuid AND current_theme = p_theme_key
  RETURNING total_pp INTO v_new_total_pp;
  
  -- Se è un evento, aggiorna la classifica eventi
  IF p_is_event THEN
    PERFORM update_event_leaderboard_atomic(p_user_id, p_theme_key, p_pp_gained);
  END IF;
  
  -- Costruisci risultato
  v_result := jsonb_build_object(
    'success', true,
    'new_total_pp', v_new_total_pp,
    'pp_gained', p_pp_gained,
    'next_chapter', p_chapter_number + 1
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: Crea funzione per ottenere classifica eventi
-- ============================================================================
CREATE FUNCTION get_event_leaderboard(
  p_theme TEXT, 
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  user_id TEXT,
  total_pp INTEGER,
  chapters_completed INTEGER,
  rank INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.user_id,
    el.total_pp,
    el.chapters_completed,
    el.rank,
    el.last_updated
  FROM event_leaderboard el
  WHERE el.theme = p_theme
  ORDER BY el.rank ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: Crea funzione per ottenere rank utente in evento
-- ============================================================================
CREATE FUNCTION get_user_event_rank(
  p_user_id TEXT,
  p_theme TEXT
)
RETURNS TABLE (
  rank INTEGER,
  total_pp INTEGER,
  chapters_completed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.rank,
    el.total_pp,
    el.chapters_completed
  FROM event_leaderboard el
  WHERE el.user_id = p_user_id AND el.theme = p_theme;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 9: Crea indici per performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_event_leaderboard_theme 
  ON event_leaderboard(theme);
  
CREATE INDEX IF NOT EXISTS idx_event_leaderboard_user_theme 
  ON event_leaderboard(user_id, theme);
  
CREATE INDEX IF NOT EXISTS idx_event_leaderboard_rank 
  ON event_leaderboard(theme, rank);
  
CREATE INDEX IF NOT EXISTS idx_themes_event_active 
  ON themes(is_event, is_active) 
  WHERE is_event = true;
  
CREATE INDEX IF NOT EXISTS idx_themes_event_expiration 
  ON themes(event_end_date) 
  WHERE is_event = true AND is_active = true;
  
CREATE INDEX IF NOT EXISTS idx_story_chapters_theme 
  ON story_chapters(theme_id);

-- ============================================================================
-- STEP 10: Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_event() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_chapter_atomic(TEXT, TEXT, INTEGER, INTEGER, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_event_leaderboard(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_event_rank(TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- COMPLETATO: Sistema eventi pronto per produzione
-- ============================================================================
