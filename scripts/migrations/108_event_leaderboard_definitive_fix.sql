-- ============================================================
-- SCRIPT 108: FIX DEFINITIVO CLASSIFICA CONTEST
-- ============================================================
-- ROOT CAUSE: La funzione get_event_leaderboard_v2 dichiara
-- user_id come BIGINT ma event_leaderboard.user_id è UUID.
-- Questo causa un type mismatch nel JOIN.
-- ============================================================

-- STEP 1: Diagnostica pre-fix
DO $$
DECLARE
    v_count INTEGER;
    v_theme TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNOSTICA PRE-FIX';
    RAISE NOTICE '========================================';
    
    -- Conta record in event_leaderboard
    SELECT COUNT(*) INTO v_count FROM event_leaderboard;
    RAISE NOTICE 'Record totali in event_leaderboard: %', v_count;
    
    -- Conta record con PP > 0
    SELECT COUNT(*) INTO v_count FROM event_leaderboard WHERE total_pp > 0;
    RAISE NOTICE 'Record con PP > 0: %', v_count;
    
    -- Mostra temi presenti
    FOR v_theme IN SELECT DISTINCT theme FROM event_leaderboard LOOP
        RAISE NOTICE 'Tema trovato: %', v_theme;
    END LOOP;
    
    -- Verifica JOIN users
    SELECT COUNT(*) INTO v_count 
    FROM event_leaderboard el
    JOIN users u ON el.user_id = u.id;
    RAISE NOTICE 'Record con JOIN users valido: %', v_count;
    
    -- Verifica record orfani (user_id non esiste in users)
    SELECT COUNT(*) INTO v_count 
    FROM event_leaderboard el
    LEFT JOIN users u ON el.user_id = u.id
    WHERE u.id IS NULL;
    RAISE NOTICE 'Record ORFANI (user_id non in users): %', v_count;
END $$;

-- STEP 2: Drop funzioni esistenti
DROP FUNCTION IF EXISTS get_event_leaderboard_v2(text, integer);
DROP FUNCTION IF EXISTS get_event_leaderboard(text, integer);

-- STEP 3: Ricrea get_event_leaderboard_v2 con tipi CORRETTI
CREATE OR REPLACE FUNCTION get_event_leaderboard_v2(
    p_theme TEXT, 
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    user_id UUID,           -- CORRETTO: UUID non BIGINT
    telegram_id BIGINT,
    first_name TEXT,
    username TEXT,
    total_pp INTEGER,
    chapters_completed INTEGER,
    rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        el.user_id,
        u.telegram_id,
        u.first_name,
        u.username,
        el.total_pp,
        el.chapters_completed,
        ROW_NUMBER() OVER (ORDER BY el.total_pp DESC, el.chapters_completed DESC)::BIGINT as rank
    FROM event_leaderboard el
    INNER JOIN users u ON el.user_id = u.id
    WHERE el.theme = p_theme
      AND el.total_pp > 0
    ORDER BY el.total_pp DESC, el.chapters_completed DESC
    LIMIT p_limit;
END;
$$;

-- STEP 4: Crea anche versione legacy per compatibilità
CREATE OR REPLACE FUNCTION get_event_leaderboard(
    p_theme TEXT, 
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    user_id TEXT,           -- Versione legacy usa TEXT
    total_pp INTEGER,
    chapters_completed INTEGER,
    rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        el.user_id::TEXT,
        el.total_pp,
        el.chapters_completed,
        ROW_NUMBER() OVER (ORDER BY el.total_pp DESC, el.chapters_completed DESC)::INTEGER as rank
    FROM event_leaderboard el
    WHERE el.theme = p_theme
      AND el.total_pp > 0
    ORDER BY el.total_pp DESC, el.chapters_completed DESC
    LIMIT p_limit;
END;
$$;

-- STEP 5: Assicurati che update_event_leaderboard_atomic esista con signature corretta
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(uuid, text, integer);
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(bigint, text, integer, integer);

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
BEGIN
    INSERT INTO event_leaderboard (user_id, theme, total_pp, chapters_completed, last_updated)
    VALUES (p_user_id, p_theme, p_pp_gained, 1, NOW())
    ON CONFLICT (user_id, theme) DO UPDATE SET
        total_pp = event_leaderboard.total_pp + EXCLUDED.total_pp,
        chapters_completed = event_leaderboard.chapters_completed + 1,
        last_updated = NOW();
END;
$$;

-- STEP 6: Ricrea get_user_event_stats con signature corretta
DROP FUNCTION IF EXISTS get_user_event_stats(uuid, text);
DROP FUNCTION IF EXISTS get_user_event_stats(bigint, text);

CREATE OR REPLACE FUNCTION get_user_event_stats(
    p_user_id UUID,
    p_theme TEXT
)
RETURNS TABLE(
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
    v_rank BIGINT;
    v_total BIGINT;
    v_last_updated TIMESTAMPTZ;
BEGIN
    -- Get user's stats
    SELECT el.total_pp, el.chapters_completed, el.last_updated
    INTO v_user_pp, v_user_chapters, v_last_updated
    FROM event_leaderboard el
    WHERE el.user_id = p_user_id AND el.theme = p_theme;
    
    -- If user not found, return defaults
    IF v_user_pp IS NULL THEN
        v_user_pp := 0;
        v_user_chapters := 0;
        v_rank := 0;
    ELSE
        -- Calculate rank
        SELECT COUNT(*) + 1 INTO v_rank
        FROM event_leaderboard el2
        WHERE el2.theme = p_theme
          AND (el2.total_pp > v_user_pp 
               OR (el2.total_pp = v_user_pp AND el2.chapters_completed > v_user_chapters));
    END IF;
    
    -- Get total participants
    SELECT COUNT(*) INTO v_total
    FROM event_leaderboard el3
    WHERE el3.theme = p_theme AND el3.total_pp > 0;
    
    RETURN QUERY SELECT 
        p_user_id,
        p_theme,
        v_user_pp,
        v_user_chapters,
        v_rank,
        v_total,
        v_last_updated;
END;
$$;

-- STEP 7: Assicurati che get_active_event funzioni
DROP FUNCTION IF EXISTS get_active_event();

CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE(
    theme_id TEXT,
    theme_name TEXT,
    theme_description TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.name::TEXT as theme_id,
        COALESCE(t.title, t.name)::TEXT as theme_name,
        t.description::TEXT as theme_description,
        t.event_start_date as start_date,
        t.event_end_date as end_date
    FROM themes t
    WHERE t.is_event = true
      AND t.is_active = true
      AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
      AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
    ORDER BY t.event_start_date DESC NULLS LAST
    LIMIT 1;
END;
$$;

-- STEP 8: Grant permissions
GRANT EXECUTE ON FUNCTION get_event_leaderboard_v2(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_event_leaderboard(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(uuid, text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_event_stats(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_active_event() TO anon, authenticated, service_role;

-- STEP 9: Verifica constraint unique
DO $$
BEGIN
    -- Assicurati che esista il constraint unique su (user_id, theme)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'event_leaderboard_user_theme_unique'
    ) THEN
        -- Prima rimuovi eventuali duplicati
        DELETE FROM event_leaderboard a
        USING event_leaderboard b
        WHERE a.id > b.id
          AND a.user_id = b.user_id
          AND a.theme = b.theme;
        
        -- Poi crea il constraint
        ALTER TABLE event_leaderboard 
        ADD CONSTRAINT event_leaderboard_user_theme_unique 
        UNIQUE (user_id, theme);
        
        RAISE NOTICE 'Creato constraint unique su (user_id, theme)';
    ELSE
        RAISE NOTICE 'Constraint unique già esistente';
    END IF;
END $$;

-- STEP 10: Diagnostica post-fix
DO $$
DECLARE
    v_count INTEGER;
    v_rec RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNOSTICA POST-FIX';
    RAISE NOTICE '========================================';
    
    -- Test get_event_leaderboard_v2
    SELECT COUNT(*) INTO v_count 
    FROM get_event_leaderboard_v2('news', 100);
    RAISE NOTICE 'get_event_leaderboard_v2(news, 100) ritorna % record', v_count;
    
    -- Mostra top 3
    RAISE NOTICE 'Top 3 classifica news:';
    FOR v_rec IN 
        SELECT rank, first_name, total_pp, chapters_completed 
        FROM get_event_leaderboard_v2('news', 3)
    LOOP
        RAISE NOTICE '  #% - % - % PP - % capitoli', 
            v_rec.rank, v_rec.first_name, v_rec.total_pp, v_rec.chapters_completed;
    END LOOP;
    
    -- Test get_active_event
    SELECT COUNT(*) INTO v_count FROM get_active_event();
    RAISE NOTICE 'get_active_event() ritorna % eventi attivi', v_count;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FIX COMPLETATO';
    RAISE NOTICE '========================================';
END $$;
