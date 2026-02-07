-- Fix per transazioni atomiche e race conditions nel sistema eventi

-- Aggiunta funzione atomica per aggiornare classifica evento con lock
-- Questa funzione previene race conditions usando row-level locking
CREATE OR REPLACE FUNCTION update_event_leaderboard_atomic(
  p_user_id TEXT,
  p_theme_id UUID,
  p_pp_gained INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- Use INSERT ... ON CONFLICT with row-level locking to prevent race conditions
  INSERT INTO event_leaderboard (user_id, theme_id, total_event_pp, chapters_completed, last_updated)
  VALUES (p_user_id, p_theme_id, p_pp_gained, 1, NOW())
  ON CONFLICT (user_id, theme_id) 
  DO UPDATE SET
    total_event_pp = event_leaderboard.total_event_pp + p_pp_gained,
    chapters_completed = event_leaderboard.chapters_completed + 1,
    last_updated = NOW()
  WHERE event_leaderboard.user_id = p_user_id 
    AND event_leaderboard.theme_id = p_theme_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione migliorata per ottenere evento attivo con controllo scadenza
CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE(
  id UUID,
  name TEXT,
  title TEXT,
  description TEXT,
  event_emoji TEXT,
  pp_multiplier NUMERIC,
  event_start_date TIMESTAMP WITH TIME ZONE,
  event_end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN,
  theme_key TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.title,
    t.description,
    t.event_emoji,
    t.pp_multiplier,
    t.event_start_date,
    t.event_end_date,
    t.is_active,
    t.theme_key
  FROM themes t
  WHERE t.is_event = true
    AND t.is_active = true
    AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
  ORDER BY t.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per disattivare automaticamente eventi scaduti
CREATE OR REPLACE FUNCTION deactivate_expired_events()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE themes
  SET is_active = false
  WHERE is_event = true
    AND is_active = true
    AND event_end_date IS NOT NULL
    AND event_end_date <= NOW();
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Deactivated % expired event(s)', affected_rows;
  END IF;
  
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fixed FOR UPDATE syntax - must use SELECT first, then UPDATE
CREATE OR REPLACE FUNCTION complete_chapter_atomic(
  p_user_id TEXT,
  p_theme_key TEXT,
  p_chapter_number INTEGER,
  p_pp_gained INTEGER,
  p_is_event BOOLEAN DEFAULT false,
  p_theme_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_new_total_pp INTEGER;
  v_progress_id UUID;
  v_user_uuid UUID;
BEGIN
  -- Convert user_id to UUID
  v_user_uuid := p_user_id::UUID;
  
  -- Lock user_progress row first with SELECT FOR UPDATE
  SELECT id INTO v_progress_id
  FROM user_progress
  WHERE user_id = p_user_id AND current_theme = p_theme_key
  FOR UPDATE;
  
  -- Now update user_progress
  UPDATE user_progress
  SET 
    current_chapter = p_chapter_number + 1,
    last_updated = NOW()
  WHERE user_id = p_user_id AND current_theme = p_theme_key;
  
  -- Lock users row first with SELECT FOR UPDATE
  SELECT total_pp INTO v_new_total_pp
  FROM users
  WHERE id = v_user_uuid
  FOR UPDATE;
  
  -- Now update users total_pp
  UPDATE users
  SET 
    total_pp = COALESCE(total_pp, 0) + p_pp_gained,
    last_updated = NOW()
  WHERE id = v_user_uuid
  RETURNING total_pp INTO v_new_total_pp;
  
  -- If it's an event, update event leaderboard atomically
  IF p_is_event AND p_theme_id IS NOT NULL THEN
    PERFORM update_event_leaderboard_atomic(p_user_id, p_theme_id, p_pp_gained);
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'new_total_pp', v_new_total_pp,
    'pp_gained', p_pp_gained,
    'next_chapter', p_chapter_number + 1
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(TEXT, UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_chapter_atomic(TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, UUID) TO anon, authenticated;

-- Create index for faster event expiration checks
CREATE INDEX IF NOT EXISTS idx_themes_event_expiration ON themes(is_event, is_active, event_end_date) 
WHERE is_event = true AND is_active = true;
