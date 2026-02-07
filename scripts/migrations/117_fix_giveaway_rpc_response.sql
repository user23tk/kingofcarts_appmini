-- Migration: Fix get_active_giveaway_for_user response structure
-- Date: 2026-02-07
-- Description: Restores missing fields (ticket_numbers, full giveaway details) that were removed in migration 116

CREATE OR REPLACE FUNCTION get_active_giveaway_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_giveaway RECORD;
  v_user_data JSONB;
  v_user_entries JSONB;
  v_winner RECORD;
  v_time_remaining BIGINT;
  v_onboarding_bonus_claimed BOOLEAN;
BEGIN
  -- Get active giveaway (Must be active AND not expired)
  SELECT 
    g.*,
    t.name as theme_name,
    t.title as theme_title,
    t.event_emoji as theme_emoji
  INTO v_giveaway
  FROM giveaways g
  LEFT JOIN themes t ON t.id = g.theme_id
  WHERE g.is_active = true
    AND g.ends_at > NOW()
  ORDER BY g.ends_at ASC -- Prioritize the one ending soonest
  LIMIT 1;
  
  -- Get onboarding status
  SELECT COALESCE(onboarding_bonus_claimed, false)
  INTO v_onboarding_bonus_claimed
  FROM user_progress
  WHERE user_id = p_user_id;
  
  IF v_giveaway.id IS NULL THEN
    RETURN jsonb_build_object(
        'giveaway', NULL, 
        'user_data', jsonb_build_object('onboarding_bonus_claimed', COALESCE(v_onboarding_bonus_claimed, false))
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
  
  -- Calculate time remaining
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
      'ticket_numbers', v_user_entries,
      'onboarding_bonus_claimed', COALESCE(v_onboarding_bonus_claimed, false)
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
