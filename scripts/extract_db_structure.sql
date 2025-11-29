-- ============================================
-- SCRIPT: Extract Complete Supabase DB Structure
-- ============================================
-- Esegui questo script nel SQL Editor di Supabase
-- o tramite il debug panel per ottenere la struttura completa

-- ============================================
-- 1. TUTTE LE TABELLE CON COLONNE
-- ============================================
SELECT 
    '=== TABLES ===' as section;

SELECT 
    t.table_schema,
    t.table_name,
    c.column_name,
    c.data_type,
    c.column_default,
    c.is_nullable,
    c.character_maximum_length,
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        ELSE ''
    END as is_primary_key
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
LEFT JOIN (
    SELECT ku.table_schema, ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON c.table_schema = pk.table_schema 
    AND c.table_name = pk.table_name 
    AND c.column_name = pk.column_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- ============================================
-- 2. FOREIGN KEYS
-- ============================================
SELECT 
    '=== FOREIGN KEYS ===' as section;

SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================
-- 3. INDEXES
-- ============================================
SELECT 
    '=== INDEXES ===' as section;

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- 4. RPC FUNCTIONS (STORED PROCEDURES)
-- ============================================
SELECT 
    '=== RPC FUNCTIONS ===' as section;

SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments,
    pg_catalog.pg_get_function_result(p.oid) as return_type,
    CASE p.prokind
        WHEN 'f' THEN 'function'
        WHEN 'p' THEN 'procedure'
        WHEN 'a' THEN 'aggregate'
        WHEN 'w' THEN 'window'
    END as kind,
    p.prosecdef as security_definer,
    l.lanname as language,
    pg_catalog.pg_get_functiondef(p.oid) as full_definition
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
    AND p.prokind IN ('f', 'p')
ORDER BY p.proname;

-- ============================================
-- 5. RLS POLICIES
-- ============================================
SELECT 
    '=== RLS POLICIES ===' as section;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- 6. RLS STATUS PER TABLE
-- ============================================
SELECT 
    '=== RLS STATUS ===' as section;

-- Using pg_class instead of pg_tables, removed forcerowsecurity column
SELECT 
    n.nspname as schemaname,
    c.relname as tablename,
    c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
    AND c.relkind = 'r'
ORDER BY c.relname;

-- ============================================
-- 7. TRIGGERS
-- ============================================
SELECT 
    '=== TRIGGERS ===' as section;

SELECT 
    trigger_schema,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 8. VIEWS
-- ============================================
SELECT 
    '=== VIEWS ===' as section;

SELECT 
    table_schema,
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- 9. SEQUENCES
-- ============================================
SELECT 
    '=== SEQUENCES ===' as section;

SELECT 
    sequence_schema,
    sequence_name,
    data_type,
    start_value,
    minimum_value,
    maximum_value,
    increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- ============================================
-- 10. ENUM TYPES
-- ============================================
SELECT 
    '=== ENUM TYPES ===' as section;

SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value,
    e.enumsortorder as sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;

-- ============================================
-- 11. TABLE SIZES
-- ============================================
SELECT 
    '=== TABLE SIZES ===' as section;

SELECT 
    relname as table_name,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size,
    pg_size_pretty(pg_relation_size(relid)) as data_size,
    pg_size_pretty(pg_indexes_size(relid)) as index_size,
    n_live_tup as estimated_row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;

-- ============================================
-- 12. SUMMARY COUNT
-- ============================================
SELECT 
    '=== SUMMARY ===' as section;

SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
    (SELECT COUNT(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')) as total_functions,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_rls_policies,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public') as total_triggers,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public') as total_views,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes;
