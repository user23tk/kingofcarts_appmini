-- Script per pulire tabelle legacy e dati obsoleti

-- Rimuovi tabella generated_chapters (legacy)
DROP TABLE IF EXISTS generated_chapters CASCADE;

-- Rimuovi eventuali indici orfani
DROP INDEX IF EXISTS idx_generated_chapters_theme;
DROP INDEX IF EXISTS idx_generated_chapters_active;

-- Pulisci eventuali funzioni obsolete
DROP FUNCTION IF EXISTS get_generated_chapter(text, integer);
DROP FUNCTION IF EXISTS create_generated_chapter(text, text, jsonb);

-- Commento per documentazione
COMMENT ON TABLE story_chapters IS 'Tabella principale per i capitoli delle storie - sostituisce generated_chapters';
COMMENT ON TABLE themes IS 'Temi disponibili per le storie';

-- Verifica integrità dati
DO $$
BEGIN
    -- Verifica che tutti i temi abbiano almeno un capitolo
    IF EXISTS (
        SELECT 1 FROM themes t 
        WHERE t.is_active = true 
        AND NOT EXISTS (
            SELECT 1 FROM story_chapters sc 
            WHERE sc.theme_id = t.id AND sc.is_active = true
        )
    ) THEN
        RAISE WARNING 'Alcuni temi attivi non hanno capitoli associati';
    END IF;
END $$;
