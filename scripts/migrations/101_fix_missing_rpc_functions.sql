-- ============================================================================
-- FIX: FUNZIONI RPC MANCANTI
-- Questo script crea le funzioni RPC che vengono chiamate dal codice ma non esistono
-- ============================================================================

-- Funzione per aggiornare il progresso di un tema
CREATE OR REPLACE FUNCTION update_theme_progress(
  p_user_id UUID,
  p_theme TEXT,
  p_chapter INTEGER,
  p_completed BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  v_current_progress JSONB;
  v_completed_themes_array TEXT[];
  v_chapters_in_theme INTEGER;
BEGIN
  -- Ottieni progresso attuale
  SELECT theme_progress, completed_themes 
  INTO v_current_progress, v_completed_themes_array
  FROM user_progress 
  WHERE user_id = p_user_id;
  
  -- Calcola capitoli completati per questo tema
  v_chapters_in_theme := GREATEST(0, p_chapter - 1);
  
  -- Aggiorna progresso tema nel JSONB
  v_current_progress := COALESCE(v_current_progress, '{}'::jsonb) || 
    jsonb_build_object(p_theme, jsonb_build_object(
      'current_chapter', p_chapter,
      'chapters_completed', v_chapters_in_theme,
      'completed', p_completed,
      'updated_at', NOW()
    ));
  
  -- Aggiorna array temi completati se necessario
  IF p_completed AND NOT (p_theme = ANY(COALESCE(v_completed_themes_array, ARRAY[]::TEXT[]))) THEN
    v_completed_themes_array := array_append(COALESCE(v_completed_themes_array, ARRAY[]::TEXT[]), p_theme);
  END IF;
  
  -- Aggiorna tabella user_progress
  UPDATE user_progress
  SET 
    theme_progress = v_current_progress,
    completed_themes = v_completed_themes_array,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Se utente non esiste, crealo
  IF NOT FOUND THEN
    INSERT INTO user_progress (
      user_id, 
      theme_progress, 
      completed_themes,
      chapters_completed,
      themes_completed,
      total_pp
    )
    VALUES (
      p_user_id, 
      v_current_progress, 
      COALESCE(v_completed_themes_array, ARRAY[]::TEXT[]),
      0,
      0,
      0
    );
  END IF;
  
  RAISE NOTICE 'Updated theme progress for user % - theme: %, chapter: %, completed: %', 
    p_user_id, p_theme, p_chapter, p_completed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commento sulla funzione
COMMENT ON FUNCTION update_theme_progress IS 'Aggiorna il progresso di un tema specifico per un utente, mantenendo sincronizzati JSONB e array';

-- Verifica che la funzione sia stata creata
SELECT 'update_theme_progress function created successfully' as status;
