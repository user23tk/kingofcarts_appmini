-- ============================================================
-- Script 080: DEBUG get_active_event
-- Diagnosi e fix per il problema della classifica contest
-- ============================================================

-- STEP 1: Mostra struttura tabella themes
SELECT 'STRUTTURA TABELLA THEMES:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'themes' AND table_schema = 'public'
ORDER BY ordinal_position;

-- STEP 2: Mostra tutti i temi evento
SELECT 'TUTTI I TEMI EVENTO:' as info;
SELECT id, name, title, is_event, is_active, event_start_date, event_end_date, pp_multiplier 
FROM themes WHERE is_event = true;

-- STEP 3: Test query semplice
SELECT 'QUERY SEMPLICE (is_event=true AND is_active=true):' as info;
SELECT id, name, title, is_event, is_active, event_start_date, event_end_date, pp_multiplier 
FROM themes WHERE is_event = true AND is_active = true;

-- STEP 4: Drop funzione esistente
DROP FUNCTION IF EXISTS get_active_event();

-- STEP 5: Ricrea funzione con colonne corrette
CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE (
  theme_name TEXT,
  theme_title TEXT,
  theme_description TEXT,
  theme_is_active BOOLEAN,
  theme_event_start_date TIMESTAMPTZ,
  theme_event_end_date TIMESTAMPTZ,
  theme_pp_multiplier NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.name,
    t.title,
    t.description,
    t.is_active,
    t.event_start_date,
    t.event_end_date,
    COALESCE(t.pp_multiplier, 1.5)
  FROM themes t
  WHERE t.is_event = true 
    AND t.is_active = true
  LIMIT 1;
$$;

-- STEP 6: GRANT permessi
GRANT EXECUTE ON FUNCTION get_active_event() TO anon;
GRANT EXECUTE ON FUNCTION get_active_event() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_event() TO service_role;

-- STEP 7: Test finale
SELECT 'TEST FINALE get_active_event():' as info;
SELECT * FROM get_active_event();
