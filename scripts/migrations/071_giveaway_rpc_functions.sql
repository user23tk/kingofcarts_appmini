-- =====================================================
-- GIVEAWAY MVP - RPC FUNCTIONS
-- =====================================================
-- Run this AFTER 070_giveaway_schema.sql

-- 1. Calculate user tickets for a giveaway
CREATE OR REPLACE FUNCTION calculate_user_tickets(
  p_user_id UUID,
  p_giveaway_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_total_pp INTEGER;
  v_pp_per_ticket INTEGER;
  v_tickets_total INTEGER;
  v_tickets_used INTEGER;
  v_tickets_available INTEGER;
BEGIN
  -- Get user's total PP
  SELECT COALESCE(total_pp, 0) INTO v_total_pp
  FROM user_progress
  WHERE user_id = p_user_id;
  
  -- Get giveaway config
  SELECT pp_per_ticket INTO v_pp_per_ticket
  FROM giveaways
  WHERE id = p_giveaway_id;
  
  -- If giveaway not found, return error
  IF v_pp_per_ticket IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Giveaway not found',
      'success', false
    );
  END IF;
  
  -- Calculate total tickets based on PP
  v_tickets_total := FLOOR(v_total_pp::NUMERIC / v_pp_per_ticket);
  
  -- Count tickets already used
  SELECT COUNT(*) INTO v_tickets_used
  FROM giveaway_entries
  WHERE giveaway_id = p_giveaway_id AND user_id = p_user_id;
  
  -- Calculate available tickets (never negative)
  v_tickets_available := GREATEST(v_tickets_total - v_tickets_used, 0);
  
  RETURN jsonb_build_object(
    'success', true,
    'total_pp', v_total_pp,
    'pp_per_ticket', v_pp_per_ticket,
    'tickets_total', v_tickets_total,
    'tickets_used', v_tickets_used,
    'tickets_available', v_tickets_available,
    'pp_for_next_ticket', v_pp_per_ticket - (v_total_pp % v_pp_per_ticket)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Allocate a single ticket to a user
CREATE OR REPLACE FUNCTION allocate_giveaway_ticket(
  p_giveaway_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_ticket_number BIGINT;
  v_giveaway RECORD;
  v_ticket_data JSONB;
BEGIN
  -- Verify giveaway exists and is active
  SELECT id, is_active, ends_at, pp_per_ticket
  INTO v_giveaway
  FROM giveaways
  WHERE id = p_giveaway_id;
  
  IF v_giveaway.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Giveaway not found'
    );
  END IF;
  
  IF NOT v_giveaway.is_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Giveaway is not active'
    );
  END IF;
  
  IF v_giveaway.ends_at < NOW() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Giveaway has ended'
    );
  END IF;
  
  -- Check if user has available tickets
  v_ticket_data := calculate_user_tickets(p_user_id, p_giveaway_id);
  
  IF (v_ticket_data->>'tickets_available')::INTEGER < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No tickets available',
      'tickets_data', v_ticket_data
    );
  END IF;
  
  -- Get next ticket number from sequence (atomic, thread-safe)
  v_ticket_number := nextval('giveaway_ticket_numbers');
  
  -- Insert entry
  INSERT INTO giveaway_entries (giveaway_id, user_id, ticket_number)
  VALUES (p_giveaway_id, p_user_id, v_ticket_number);
  
  -- Return success with new balance
  RETURN jsonb_build_object(
    'success', true,
    'ticket_number', v_ticket_number,
    'new_balance', calculate_user_tickets(p_user_id, p_giveaway_id)
  );

EXCEPTION
  WHEN unique_violation THEN
    -- This should never happen with sequence, but just in case
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket allocation failed. Please try again.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant onboarding bonus (+200 PP)
CREATE OR REPLACE FUNCTION grant_onboarding_bonus(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_total_pp INTEGER;
  v_bonus_claimed BOOLEAN;
BEGIN
  -- Lock row to prevent race conditions
  SELECT total_pp, onboarding_bonus_claimed
  INTO v_current_total_pp, v_bonus_claimed
  FROM user_progress
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- If user doesn't exist in user_progress, create entry
  IF v_current_total_pp IS NULL THEN
    INSERT INTO user_progress (user_id, current_theme, total_pp, onboarding_bonus_claimed)
    VALUES (p_user_id, 'racing', 0, false)
    ON CONFLICT (user_id) DO NOTHING;
    
    SELECT total_pp, onboarding_bonus_claimed
    INTO v_current_total_pp, v_bonus_claimed
    FROM user_progress
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;
  
  -- Check if bonus already claimed
  IF v_bonus_claimed THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'bonus_already_claimed',
      'total_pp', v_current_total_pp
    );
  END IF;
  
  -- Apply bonus
  UPDATE user_progress
  SET 
    total_pp = COALESCE(total_pp, 0) + 200,
    onboarding_bonus_claimed = true,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Record in pp_audit for tracking
  INSERT INTO pp_audit (
    user_id,
    theme,
    chapter_number,
    scene_index,
    choice_id,
    pp_gained,
    session_total_pp
  ) VALUES (
    p_user_id::TEXT,
    'ONBOARDING_BONUS',
    0,
    0,
    'onboarding_bonus',
    200,
    COALESCE(v_current_total_pp, 0) + 200
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', 200,
    'new_total_pp', COALESCE(v_current_total_pp, 0) + 200
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Draw giveaway winner (admin only)
CREATE OR REPLACE FUNCTION draw_giveaway_winner(
  p_giveaway_id UUID,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_winner RECORD;
  v_giveaway RECORD;
  v_total_entries INTEGER;
BEGIN
  -- Verify giveaway exists
  SELECT id, name, is_active
  INTO v_giveaway
  FROM giveaways
  WHERE id = p_giveaway_id;
  
  IF v_giveaway.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Giveaway not found'
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
      'ticket_number', v_winner.ticket_number
    ),
    'giveaway_id', p_giveaway_id,
    'giveaway_name', v_giveaway.name,
    'total_entries', v_total_entries,
    'drawn_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Get active giveaway with user data
CREATE OR REPLACE FUNCTION get_active_giveaway_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_giveaway RECORD;
  v_user_data JSONB;
  v_user_entries JSONB;
  v_winner RECORD;
  v_time_remaining BIGINT;
BEGIN
  -- Get most recent giveaway (active first, then by date)
  SELECT 
    g.*,
    t.name as theme_name,
    t.title as theme_title,
    t.event_emoji as theme_emoji
  INTO v_giveaway
  FROM giveaways g
  LEFT JOIN themes t ON t.id = g.theme_id
  ORDER BY g.is_active DESC, g.created_at DESC
  LIMIT 1;
  
  IF v_giveaway.id IS NULL THEN
    RETURN jsonb_build_object(
      'giveaway', NULL,
      'message', 'No giveaway found'
    );
  END IF;
  
  -- Calculate user tickets
  v_user_data := calculate_user_tickets(p_user_id, v_giveaway.id);
  
  -- Get user's ticket entries (last 20)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ticket_number', ge.ticket_number,
      'created_at', ge.created_at
    ) ORDER BY ge.created_at DESC
  ), '[]'::jsonb)
  INTO v_user_entries
  FROM (
    SELECT ticket_number, created_at
    FROM giveaway_entries
    WHERE giveaway_id = v_giveaway.id AND user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) ge;
  
  -- Check for winner
  SELECT 
    gr.winning_ticket_number,
    gr.drawn_at,
    u.username as winner_username,
    u.first_name as winner_first_name,
    u.last_name as winner_last_name,
    u.id as winner_user_id
  INTO v_winner
  FROM giveaway_results gr
  JOIN users u ON u.id = gr.winner_user_id
  WHERE gr.giveaway_id = v_giveaway.id;
  
  -- Calculate time remaining in milliseconds
  v_time_remaining := GREATEST(
    EXTRACT(EPOCH FROM (v_giveaway.ends_at - NOW())) * 1000,
    0
  )::BIGINT;
  
  RETURN jsonb_build_object(
    'giveaway', jsonb_build_object(
      'id', v_giveaway.id,
      'name', v_giveaway.name,
      'description', v_giveaway.description,
      'pp_per_ticket', v_giveaway.pp_per_ticket,
      'starts_at', v_giveaway.starts_at,
      'ends_at', v_giveaway.ends_at,
      'is_active', v_giveaway.is_active,
      'prize_title', v_giveaway.prize_title,
      'prize_type', v_giveaway.prize_type,
      'prize_description', v_giveaway.prize_description,
      'prize_image_url', v_giveaway.prize_image_url,
      'prize_link', v_giveaway.prize_link,
      'time_remaining_ms', v_time_remaining,
      'has_ended', v_giveaway.ends_at < NOW(),
      'has_winner', v_winner.winner_user_id IS NOT NULL,
      'theme', CASE 
        WHEN v_giveaway.theme_id IS NOT NULL THEN
          jsonb_build_object(
            'id', v_giveaway.theme_id,
            'name', v_giveaway.theme_name,
            'title', v_giveaway.theme_title,
            'emoji', v_giveaway.theme_emoji
          )
        ELSE NULL
      END
    ),
    'user_data', jsonb_build_object(
      'total_pp', (v_user_data->>'total_pp')::INTEGER,
      'pp_per_ticket', (v_user_data->>'pp_per_ticket')::INTEGER,
      'tickets_total', (v_user_data->>'tickets_total')::INTEGER,
      'tickets_used', (v_user_data->>'tickets_used')::INTEGER,
      'tickets_available', (v_user_data->>'tickets_available')::INTEGER,
      'pp_for_next_ticket', (v_user_data->>'pp_for_next_ticket')::INTEGER,
      'ticket_numbers', v_user_entries
    ),
    'winner', CASE 
      WHEN v_winner.winner_user_id IS NOT NULL THEN
        jsonb_build_object(
          'user_id', v_winner.winner_user_id,
          'ticket_number', v_winner.winning_ticket_number,
          'username', v_winner.winner_username,
          'display_name', COALESCE(v_winner.winner_first_name, '') || 
            CASE WHEN v_winner.winner_last_name IS NOT NULL 
              THEN ' ' || v_winner.winner_last_name 
              ELSE '' 
            END,
          'drawn_at', v_winner.drawn_at,
          'is_current_user', v_winner.winner_user_id = p_user_id
        )
      ELSE NULL
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Get giveaway statistics (for admin)
CREATE OR REPLACE FUNCTION get_giveaway_stats(p_giveaway_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_stats RECORD;
BEGIN
  SELECT 
    g.id,
    g.name,
    g.is_active,
    g.starts_at,
    g.ends_at,
    (SELECT COUNT(DISTINCT user_id) FROM giveaway_entries WHERE giveaway_id = g.id) as unique_participants,
    (SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id = g.id) as total_entries,
    (SELECT MIN(ticket_number) FROM giveaway_entries WHERE giveaway_id = g.id) as first_ticket,
    (SELECT MAX(ticket_number) FROM giveaway_entries WHERE giveaway_id = g.id) as last_ticket,
    (SELECT AVG(cnt) FROM (
      SELECT COUNT(*) as cnt FROM giveaway_entries WHERE giveaway_id = g.id GROUP BY user_id
    ) sub) as avg_tickets_per_user
  INTO v_stats
  FROM giveaways g
  WHERE g.id = p_giveaway_id;
  
  IF v_stats.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Giveaway not found');
  END IF;
  
  RETURN jsonb_build_object(
    'giveaway_id', v_stats.id,
    'name', v_stats.name,
    'is_active', v_stats.is_active,
    'starts_at', v_stats.starts_at,
    'ends_at', v_stats.ends_at,
    'unique_participants', v_stats.unique_participants,
    'total_entries', v_stats.total_entries,
    'first_ticket', v_stats.first_ticket,
    'last_ticket', v_stats.last_ticket,
    'avg_tickets_per_user', ROUND(v_stats.avg_tickets_per_user::NUMERIC, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Check onboarding bonus status
CREATE OR REPLACE FUNCTION check_onboarding_bonus_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_bonus_claimed BOOLEAN;
  v_total_pp INTEGER;
BEGIN
  SELECT onboarding_bonus_claimed, total_pp
  INTO v_bonus_claimed, v_total_pp
  FROM user_progress
  WHERE user_id = p_user_id;
  
  IF v_bonus_claimed IS NULL THEN
    -- User doesn't have progress yet
    RETURN jsonb_build_object(
      'can_claim', true,
      'already_claimed', false,
      'total_pp', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'can_claim', NOT v_bonus_claimed,
    'already_claimed', v_bonus_claimed,
    'total_pp', COALESCE(v_total_pp, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_user_tickets IS 'Calculates available tickets for a user based on total PP';
COMMENT ON FUNCTION allocate_giveaway_ticket IS 'Allocates a single numbered ticket to a user (atomic)';
COMMENT ON FUNCTION grant_onboarding_bonus IS 'Grants +200 PP onboarding bonus (idempotent)';
COMMENT ON FUNCTION draw_giveaway_winner IS 'Randomly draws a winner from giveaway entries (admin)';
COMMENT ON FUNCTION get_active_giveaway_for_user IS 'Gets active giveaway with user ticket data';
COMMENT ON FUNCTION get_giveaway_stats IS 'Gets statistics for a giveaway (admin)';
COMMENT ON FUNCTION check_onboarding_bonus_status IS 'Checks if user can claim onboarding bonus';
