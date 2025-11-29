-- Script: 111_fix_giveaway_validation.sql
-- Fix giveaway system: validate end date before drawing and add deactivate function

-- Function: deactivate_expired_giveaways
-- Automatically deactivates giveaways that have passed their end date
CREATE OR REPLACE FUNCTION deactivate_expired_giveaways()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deactivated_count integer;
BEGIN
  WITH deactivated AS (
    UPDATE giveaways
    SET is_active = false, updated_at = NOW()
    WHERE is_active = true
      AND ends_at IS NOT NULL
      AND ends_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deactivated_count FROM deactivated;
  
  RETURN v_deactivated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_expired_giveaways() TO authenticated, anon;

-- Update draw_giveaway_winner to validate giveaway has ended before drawing
DROP FUNCTION IF EXISTS public.draw_giveaway_winner(uuid, uuid);

CREATE OR REPLACE FUNCTION draw_giveaway_winner(
  p_giveaway_id uuid, 
  p_admin_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner RECORD;
  v_giveaway RECORD;
  v_total_entries INTEGER;
BEGIN
  -- Verify giveaway exists
  SELECT id, name, is_active, ends_at, starts_at
  INTO v_giveaway
  FROM giveaways
  WHERE id = p_giveaway_id;
  
  IF v_giveaway.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Giveaway not found'
    );
  END IF;
  
  -- NUOVO: Check if giveaway has ended before allowing extraction
  IF v_giveaway.ends_at IS NOT NULL AND v_giveaway.ends_at > NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Giveaway is still active. Cannot draw winner before end date.',
      'ends_at', v_giveaway.ends_at
    );
  END IF;
  
  -- Check if winner already drawn
  IF EXISTS (
    SELECT 1 FROM giveaway_results WHERE giveaway_id = p_giveaway_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Winner already drawn for this giveaway'
    );
  END IF;
  
  -- Count entries
  SELECT COUNT(*) INTO v_total_entries
  FROM giveaway_entries
  WHERE giveaway_id = p_giveaway_id;
  
  IF v_total_entries = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No entries for this giveaway'
    );
  END IF;
  
  -- Random extraction of ONE ticket
  SELECT 
    ge.id as entry_id,
    ge.user_id,
    ge.ticket_number,
    u.telegram_id,
    u.username,
    u.first_name,
    u.last_name
  INTO v_winner
  FROM giveaway_entries ge
  JOIN users u ON u.id = ge.user_id
  WHERE ge.giveaway_id = p_giveaway_id
  ORDER BY random()
  LIMIT 1;
  
  -- Insert result
  INSERT INTO giveaway_results (
    giveaway_id,
    winner_user_id,
    winning_ticket_number,
    drawn_by_admin_id
  ) VALUES (
    p_giveaway_id,
    v_winner.user_id,
    v_winner.ticket_number,
    p_admin_user_id
  );
  
  -- Deactivate giveaway after extraction
  UPDATE giveaways
  SET is_active = false, updated_at = NOW()
  WHERE id = p_giveaway_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'winner', jsonb_build_object(
      'user_id', v_winner.user_id,
      'telegram_id', v_winner.telegram_id,
      'username', v_winner.username,
      'first_name', v_winner.first_name,
      'last_name', v_winner.last_name,
      'winning_ticket', v_winner.ticket_number
    ),
    'giveaway_name', v_giveaway.name,
    'total_entries', v_total_entries
  );
END;
$$;

GRANT EXECUTE ON FUNCTION draw_giveaway_winner(uuid, uuid) TO authenticated, anon;
