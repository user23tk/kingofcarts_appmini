-- ============================================================================
-- APPLICAZIONE COMPLETA DI TUTTI I FIX
-- Questo script applica tutti i fix identificati nell'audit in sequenza
-- ============================================================================

-- Inizio transazione per rollback in caso di errori
BEGIN;

SELECT 'Starting complete fix application...' as status;

-- 1. Crea funzioni RPC mancanti
\i scripts/101_fix_missing_rpc_functions.sql

-- 2. Sincronizza campi duplicati
\i scripts/102_sync_duplicate_fields.sql

-- 3. Rimuovi funzioni leaderboard errate
\i scripts/103_remove_broken_leaderboard.sql

-- 4. Verifica che il campo completed_themes esista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_progress' AND column_name = 'completed_themes'
  ) THEN
    ALTER TABLE user_progress ADD COLUMN completed_themes TEXT[] DEFAULT ARRAY[]::TEXT[];
    RAISE NOTICE 'Added completed_themes column to user_progress table';
  ELSE
    RAISE NOTICE 'completed_themes column already exists';
  END IF;
END $$;

-- 5. Popola completed_themes array da theme_progress JSONB
UPDATE user_progress 
SET completed_themes = (
  SELECT ARRAY(
    SELECT key
    FROM jsonb_each(theme_progress)
    WHERE (value->>'completed')::BOOLEAN = TRUE
  )
)
WHERE completed_themes IS NULL 
   OR array_length(completed_themes, 1) IS NULL
   OR array_length(completed_themes, 1) != themes_completed;

-- 6. Verifica e correggi themes_completed basandosi su completed_themes
UPDATE user_progress 
SET themes_completed = COALESCE(array_length(completed_themes, 1), 0)
WHERE themes_completed != COALESCE(array_length(completed_themes, 1), 0);

-- 7. Aggiorna statistiche globali se necessarie
DO $$
DECLARE
  actual_chapters INTEGER;
  actual_themes INTEGER;
  global_chapters INTEGER;
  global_themes INTEGER;
BEGIN
  -- Calcola valori reali
  SELECT COALESCE(SUM(chapters_completed), 0) INTO actual_chapters FROM user_progress;
  SELECT COALESCE(SUM(themes_completed), 0) INTO actual_themes FROM user_progress;
  
  -- Ottieni valori globali attuali
  SELECT COALESCE(stat_value, 0) INTO global_chapters 
  FROM global_stats WHERE stat_name = 'total_chapters_completed';
  
  SELECT COALESCE(stat_value, 0) INTO global_themes 
  FROM global_stats WHERE stat_name = 'total_themes_completed';
  
  -- Aggiorna se necessario
  IF global_chapters != actual_chapters THEN
    INSERT INTO global_stats (stat_name, stat_value) 
    VALUES ('total_chapters_completed', actual_chapters)
    ON CONFLICT (stat_name) 
    DO UPDATE SET stat_value = actual_chapters, updated_at = NOW();
    
    RAISE NOTICE 'Updated global chapters: % -> %', global_chapters, actual_chapters;
  END IF;
  
  IF global_themes != actual_themes THEN
    INSERT INTO global_stats (stat_name, stat_value) 
    VALUES ('total_themes_completed', actual_themes)
    ON CONFLICT (stat_name) 
    DO UPDATE SET stat_value = actual_themes, updated_at = NOW();
    
    RAISE NOTICE 'Updated global themes: % -> %', global_themes, actual_themes;
  END IF;
END $$;

-- 8. Test finale di consistenza
\i scripts/105_test_consistency.sql

-- Commit se tutto è andato bene
COMMIT;

SELECT 'All fixes applied successfully!' as final_status;
