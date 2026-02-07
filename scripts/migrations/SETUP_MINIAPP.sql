-- ============================================
-- SETUP COMPLETO MINI APP - ESEGUI UNA VOLTA
-- ============================================
-- Questo script aggiunge solo ciò che manca per far funzionare la Mini App
-- Non tocca tabelle esistenti che già funzionano

-- ============================================
-- STEP 1: Aggiungi colonne mancanti a user_progress
-- ============================================

-- Aggiungi chapters_completed (somma di tutti i capitoli completati)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_progress' AND column_name = 'chapters_completed'
  ) THEN
    ALTER TABLE user_progress ADD COLUMN chapters_completed INTEGER DEFAULT 0;
    
    -- Migra i dati esistenti
    UPDATE user_progress 
    SET chapters_completed = COALESCE(total_chapters_completed, 0);
  END IF;
END $$;

-- Aggiungi themes_completed (numero di temi completati)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_progress' AND column_name = 'themes_completed'
  ) THEN
    ALTER TABLE user_progress ADD COLUMN themes_completed INTEGER DEFAULT 0;
    
    -- Migra i dati esistenti
    UPDATE user_progress 
    SET themes_completed = COALESCE(array_length(completed_themes, 1), 0);
  END IF;
END $$;

-- Assicurati che total_pp esista
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_progress' AND column_name = 'total_pp'
  ) THEN
    ALTER TABLE user_progress ADD COLUMN total_pp INTEGER DEFAULT 0;
  END IF;
END $$;

-- Assicurati che theme_progress esista
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_progress' AND column_name = 'theme_progress'
  ) THEN
    ALTER TABLE user_progress ADD COLUMN theme_progress JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================
-- STEP 2: Crea indici per performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_progress_chapters 
ON user_progress(chapters_completed DESC);

CREATE INDEX IF NOT EXISTS idx_user_progress_themes 
ON user_progress(themes_completed DESC);

CREATE INDEX IF NOT EXISTS idx_user_progress_pp 
ON user_progress(total_pp DESC);

CREATE INDEX IF NOT EXISTS idx_story_chapters_theme 
ON story_chapters(theme_id, chapter_number);

-- ============================================
-- STEP 3: Funzioni RPC per Mini App
-- ============================================

-- Funzione: Ottieni rank dell'utente
CREATE OR REPLACE FUNCTION get_user_rank(p_user_id UUID)
RETURNS TABLE (
  rank BIGINT,
  total_players BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH ranked_users AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (
        ORDER BY 
          chapters_completed DESC,
          themes_completed DESC,
          total_pp DESC
      ) as user_rank
    FROM user_progress
    WHERE chapters_completed > 0 OR themes_completed > 0
  )
  SELECT 
    COALESCE(ru.user_rank, 0)::BIGINT as rank,
    COALESCE((SELECT COUNT(*) FROM user_progress WHERE chapters_completed > 0 OR themes_completed > 0), 0)::BIGINT as total_players
  FROM ranked_users ru
  WHERE ru.user_id = p_user_id;
  
  -- Se l'utente non ha progressi, ritorna rank 0
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
  END IF;
END;
$$;

-- Funzione: Ottieni top N giocatori
CREATE OR REPLACE FUNCTION get_top_players(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  first_name TEXT,
  chapters_completed INTEGER,
  themes_completed INTEGER,
  total_pp INTEGER,
  rank BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    u.username,
    u.first_name,
    up.chapters_completed,
    up.themes_completed,
    up.total_pp,
    ROW_NUMBER() OVER (
      ORDER BY 
        up.chapters_completed DESC,
        up.themes_completed DESC,
        up.total_pp DESC
    ) as rank
  FROM user_progress up
  JOIN users u ON u.id = up.user_id
  WHERE up.chapters_completed > 0 OR up.themes_completed > 0
  ORDER BY 
    up.chapters_completed DESC,
    up.themes_completed DESC,
    up.total_pp DESC
  LIMIT p_limit;
END;
$$;

-- Funzione: Ottieni statistiche dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS TABLE (
  user_rank BIGINT,
  total_players BIGINT,
  chapters_completed INTEGER,
  themes_completed INTEGER,
  total_pp INTEGER,
  active_sessions INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_rank BIGINT;
  v_total BIGINT;
BEGIN
  -- Ottieni rank
  SELECT rank, total_players INTO v_rank, v_total
  FROM get_user_rank(p_user_id);
  
  -- Ritorna statistiche complete
  RETURN QUERY
  SELECT 
    COALESCE(v_rank, 0)::BIGINT,
    COALESCE(v_total, 0)::BIGINT,
    COALESCE(up.chapters_completed, 0),
    COALESCE(up.themes_completed, 0),
    COALESCE(up.total_pp, 0),
    0 -- active_sessions (placeholder)
  FROM user_progress up
  WHERE up.user_id = p_user_id;
  
  -- Se l'utente non esiste, ritorna valori di default
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0, 0, 0, 0;
  END IF;
END;
$$;

-- Funzione: Ottieni progressi per tema
CREATE OR REPLACE FUNCTION get_theme_progress(p_user_id UUID)
RETURNS TABLE (
  theme_name TEXT,
  theme_title TEXT,
  chapters_completed INTEGER,
  total_chapters INTEGER,
  total_pp INTEGER,
  completion_percentage NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.name,
    t.title,
    COALESCE((up.theme_progress->t.name->>'chapters_completed')::INTEGER, 0) as chapters_completed,
    COALESCE(t.total_chapters, 10) as total_chapters,
    COALESCE((up.theme_progress->t.name->>'total_pp')::INTEGER, 0) as total_pp,
    CASE 
      WHEN COALESCE(t.total_chapters, 10) > 0 THEN
        ROUND((COALESCE((up.theme_progress->t.name->>'chapters_completed')::INTEGER, 0)::NUMERIC / COALESCE(t.total_chapters, 10)::NUMERIC) * 100, 2)
      ELSE 0
    END as completion_percentage
  FROM themes t
  LEFT JOIN user_progress up ON up.user_id = p_user_id
  WHERE t.is_active = true
  ORDER BY t.name;
END;
$$;

-- Funzione: Aggiorna progresso dopo completamento capitolo
CREATE OR REPLACE FUNCTION update_chapter_completion(
  p_user_id UUID,
  p_theme_name TEXT,
  p_chapter_number INTEGER,
  p_pp_gained INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_progress JSONB;
  v_theme_chapters INTEGER;
  v_new_progress JSONB;
  v_theme_completed BOOLEAN := false;
BEGIN
  -- Ottieni progresso attuale per il tema
  SELECT theme_progress->p_theme_name INTO v_current_progress
  FROM user_progress
  WHERE user_id = p_user_id;
  
  -- Se non esiste, inizializza
  IF v_current_progress IS NULL THEN
    v_current_progress := jsonb_build_object(
      'chapters_completed', 0,
      'total_pp', 0,
      'completed_chapters', '[]'::jsonb
    );
  END IF;
  
  -- Aggiorna progresso tema
  v_new_progress := jsonb_build_object(
    'chapters_completed', COALESCE((v_current_progress->>'chapters_completed')::INTEGER, 0) + 1,
    'total_pp', COALESCE((v_current_progress->>'total_pp')::INTEGER, 0) + p_pp_gained,
    'completed_chapters', COALESCE(v_current_progress->'completed_chapters', '[]'::jsonb) || to_jsonb(p_chapter_number)
  );
  
  -- Controlla se tema completato (10 capitoli)
  IF (v_new_progress->>'chapters_completed')::INTEGER >= 10 THEN
    v_theme_completed := true;
  END IF;
  
  -- Aggiorna user_progress
  UPDATE user_progress
  SET 
    theme_progress = COALESCE(theme_progress, '{}'::jsonb) || jsonb_build_object(p_theme_name, v_new_progress),
    chapters_completed = chapters_completed + 1,
    themes_completed = CASE 
      WHEN v_theme_completed AND NOT (p_theme_name = ANY(completed_themes)) THEN themes_completed + 1
      ELSE themes_completed
    END,
    completed_themes = CASE
      WHEN v_theme_completed AND NOT (p_theme_name = ANY(completed_themes)) THEN array_append(completed_themes, p_theme_name)
      ELSE completed_themes
    END,
    total_pp = total_pp + p_pp_gained,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Se l'utente non esiste, crealo
  IF NOT FOUND THEN
    INSERT INTO user_progress (
      user_id,
      theme_progress,
      chapters_completed,
      themes_completed,
      completed_themes,
      total_pp
    ) VALUES (
      p_user_id,
      jsonb_build_object(p_theme_name, v_new_progress),
      1,
      CASE WHEN v_theme_completed THEN 1 ELSE 0 END,
      CASE WHEN v_theme_completed THEN ARRAY[p_theme_name] ELSE ARRAY[]::TEXT[] END,
      p_pp_gained
    );
  END IF;
  
  -- Ritorna nuovo progresso
  RETURN jsonb_build_object(
    'theme_progress', v_new_progress,
    'theme_completed', v_theme_completed
  );
END;
$$;

-- ============================================
-- STEP 4: Verifica setup
-- ============================================

DO $$
DECLARE
  v_users_count INTEGER;
  v_themes_count INTEGER;
  v_chapters_count INTEGER;
  v_progress_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users_count FROM users;
  SELECT COUNT(*) INTO v_themes_count FROM themes WHERE is_active = true;
  SELECT COUNT(*) INTO v_chapters_count FROM story_chapters WHERE is_active = true;
  SELECT COUNT(*) INTO v_progress_count FROM user_progress;
  
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'SETUP MINI APP COMPLETATO!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Utenti registrati: %', v_users_count;
  RAISE NOTICE 'Temi attivi: %', v_themes_count;
  RAISE NOTICE 'Capitoli disponibili: %', v_chapters_count;
  RAISE NOTICE 'Progressi salvati: %', v_progress_count;
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Funzioni RPC create:';
  RAISE NOTICE '  - get_user_rank(user_id)';
  RAISE NOTICE '  - get_top_players(limit)';
  RAISE NOTICE '  - get_dashboard_stats(user_id)';
  RAISE NOTICE '  - get_theme_progress(user_id)';
  RAISE NOTICE '  - update_chapter_completion(...)';
  RAISE NOTICE '===========================================';
  
  -- Avvisi se mancano dati critici
  IF v_themes_count = 0 THEN
    RAISE WARNING 'ATTENZIONE: Nessun tema attivo trovato!';
  END IF;
  
  IF v_chapters_count = 0 THEN
    RAISE WARNING 'ATTENZIONE: Nessun capitolo trovato! Inserisci capitoli per i temi.';
  END IF;
END $$;
