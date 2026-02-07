-- Migration: Add create_event_giveaway RPC
-- Date: 2026-02-07

DROP FUNCTION IF EXISTS create_event_giveaway(uuid, text, integer);

CREATE OR REPLACE FUNCTION create_event_giveaway(
    p_theme_id UUID,
    p_prize_title TEXT,
    p_top_n INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_theme_name TEXT;
    v_giveaway_id UUID;
    v_entries_count INTEGER;
BEGIN
    -- 1. Get theme details
    SELECT name INTO v_theme_name FROM themes WHERE id = p_theme_id;
    
    IF v_theme_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Event theme not found');
    END IF;

    -- 2. Create Giveaway
    INSERT INTO giveaways (
        theme_id,
        name,
        description,
        pp_per_ticket,
        tickets_per_entry,
        starts_at,
        ends_at,
        is_active,
        prize_title,
        prize_type
    ) VALUES (
        p_theme_id,
        'Giveaway: ' || v_theme_name,
        'Giveaway riservato ai top ' || p_top_n || ' giocatori dell''evento ' || v_theme_name,
        100, -- Standard price (cannot be 0 due to constraints)
        1,
        NOW(),
        NOW() + INTERVAL '3 days', -- Default 3 days duration
        true,
        p_prize_title,
        'telegram_gift'
    ) RETURNING id INTO v_giveaway_id;

    -- 3. Auto-enroll Top N Players
    -- We use event_leaderboard to find top players
    -- And insert them into giveaway_entries
    
    WITH top_players AS (
        SELECT user_id
        FROM event_leaderboard
        WHERE theme = v_theme_name
        ORDER BY total_pp DESC, chapters_completed DESC
        LIMIT p_top_n
    ),
    inserted_entries AS (
        INSERT INTO giveaway_entries (giveaway_id, user_id, ticket_number)
        SELECT 
            v_giveaway_id, 
            tp.user_id, 
            nextval('giveaway_ticket_numbers')
        FROM top_players tp
        RETURNING id
    )
    SELECT COUNT(*) INTO v_entries_count FROM inserted_entries;

    RETURN jsonb_build_object(
        'success', true, 
        'giveaway_id', v_giveaway_id,
        'entries_created', v_entries_count
    );
END;
$$;
