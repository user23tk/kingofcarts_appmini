-- Script finale per preparare il database per la beta

-- Verifica che tutti i temi abbiano capitoli
DO $$
DECLARE
    theme_record RECORD;
    chapter_count INTEGER;
BEGIN
    FOR theme_record IN SELECT * FROM themes WHERE is_active = true LOOP
        SELECT COUNT(*) INTO chapter_count 
        FROM story_chapters 
        WHERE theme_id = theme_record.id AND is_active = true;
        
        IF chapter_count = 0 THEN
            RAISE WARNING 'Tema % non ha capitoli attivi', theme_record.name;
        ELSE
            RAISE NOTICE 'Tema % ha % capitoli', theme_record.name, chapter_count;
        END IF;
    END LOOP;
END $$;

-- Ottimizza indici per performance
REINDEX TABLE users;
REINDEX TABLE user_progress;
REINDEX TABLE story_chapters;
REINDEX TABLE themes;
REINDEX TABLE rate_limits;

-- Aggiorna statistiche tabelle per query optimizer
ANALYZE users;
ANALYZE user_progress;
ANALYZE story_chapters;
ANALYZE themes;
ANALYZE rate_limits;
ANALYZE global_stats;

-- Verifica integrità referenziale
DO $$
BEGIN
    -- Verifica che tutti i user_progress abbiano utenti validi
    IF EXISTS (
        SELECT 1 FROM user_progress up 
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = up.user_id)
    ) THEN
        RAISE WARNING 'Trovati record user_progress orfani';
    END IF;
    
    -- Verifica che tutti i story_chapters abbiano temi validi
    IF EXISTS (
        SELECT 1 FROM story_chapters sc 
        WHERE NOT EXISTS (SELECT 1 FROM themes t WHERE t.id = sc.theme_id)
    ) THEN
        RAISE WARNING 'Trovati capitoli con temi inesistenti';
    END IF;
    
    RAISE NOTICE 'Verifica integrità completata';
END $$;

-- Commento finale
COMMENT ON DATABASE postgres IS 'King of Carts Telegram Bot - Beta Ready Database';
