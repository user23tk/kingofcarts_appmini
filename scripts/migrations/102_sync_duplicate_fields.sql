-- ============================================================================
-- FIX: SINCRONIZZAZIONE CAMPI DUPLICATI
-- Questo script sincronizza i campi duplicati e crea trigger per mantenerli allineati
-- ============================================================================

-- Verifica se il campo total_chapters_completed esiste
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_progress' AND column_name = 'total_chapters_completed'
  ) THEN
    -- Sincronizza total_chapters_completed con chapters_completed
    UPDATE user_progress 
    SET total_chapters_completed = chapters_completed
    WHERE total_chapters_completed IS NULL 
       OR total_chapters_completed != chapters_completed;
    
    RAISE NOTICE 'Synchronized % rows for total_chapters_completed field', 
      (SELECT COUNT(*) FROM user_progress WHERE total_chapters_completed != chapters_completed);
  ELSE
    RAISE NOTICE 'Field total_chapters_completed does not exist, skipping synchronization';
  END IF;
END $$;

-- Verifica e sincronizza array completed_themes con contatore themes_completed
DO $$
DECLARE
  sync_count INTEGER := 0;
BEGIN
  -- Aggiorna array completed_themes basandosi su theme_progress JSONB
  UPDATE user_progress 
  SET completed_themes = (
    SELECT ARRAY(
      SELECT key
      FROM jsonb_each(theme_progress)
      WHERE (value->>'completed')::BOOLEAN = TRUE
    )
  )
  WHERE completed_themes IS NULL 
     OR array_length(completed_themes, 1) != themes_completed
     OR themes_completed != (
       SELECT COUNT(*)
       FROM jsonb_each(theme_progress)
       WHERE (value->>'completed')::BOOLEAN = TRUE
     );
  
  GET DIAGNOSTICS sync_count = ROW_COUNT;
  RAISE NOTICE 'Synchronized % rows for completed_themes array', sync_count;
END $$;

-- Crea funzione trigger per mantenere sincronizzazione automatica
CREATE OR REPLACE FUNCTION sync_duplicate_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Sincronizza total_chapters_completed se esiste
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_progress' AND column_name = 'total_chapters_completed'
  ) THEN
    NEW.total_chapters_completed := NEW.chapters_completed;
  END IF;
  
  -- Assicura che completed_themes sia sincronizzato con themes_completed
  IF NEW.theme_progress IS NOT NULL THEN
    NEW.completed_themes := (
      SELECT ARRAY(
        SELECT key
        FROM jsonb_each(NEW.theme_progress)
        WHERE (value->>'completed')::BOOLEAN = TRUE
      )
    );
    
    -- Aggiorna themes_completed basandosi su completed_themes
    NEW.themes_completed := COALESCE(array_length(NEW.completed_themes, 1), 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea trigger per INSERT e UPDATE
DROP TRIGGER IF EXISTS sync_duplicate_fields_trigger ON user_progress;
CREATE TRIGGER sync_duplicate_fields_trigger
  BEFORE INSERT OR UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION sync_duplicate_fields();

-- Verifica stato sincronizzazione
SELECT 
  'Synchronization completed' as status,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE chapters_completed = COALESCE(total_chapters_completed, chapters_completed)) as synced_chapters,
  COUNT(*) FILTER (WHERE themes_completed = COALESCE(array_length(completed_themes, 1), 0)) as synced_themes
FROM user_progress;
