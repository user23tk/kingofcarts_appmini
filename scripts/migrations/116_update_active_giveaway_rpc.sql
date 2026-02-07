-- Migration: Update get_active_giveaway_for_user to filter by date
-- Date: 2026-02-07

CREATE OR REPLACE FUNCTION get_active_giveaway_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_giveaway RECORD;
  v_user_data JSONB;
  v_onboarding_bonus_claimed BOOLEAN;
BEGIN
  -- Get active giveaway (Must be active AND not expired)
  SELECT g.*, t.name as theme_name, t.title as theme_title, t.event_emoji
  INTO v_giveaway
  FROM giveaways g
  LEFT JOIN themes t ON t.id = g.theme_id
  WHERE g.is_active = true
    AND g.ends_at > NOW() -- Added date check
  ORDER BY g.ends_at ASC -- Prioritize the one ending soonest
  LIMIT 1;
  
  -- Get onboarding status
  SELECT COALESCE(onboarding_bonus_claimed, false)
  INTO v_onboarding_bonus_claimed
  FROM user_progress
  WHERE user_id = p_user_id;

  IF v_giveaway.id IS NULL THEN
    RETURN jsonb_build_object('giveaway', NULL, 'user_data', jsonb_build_object('onboarding_bonus_claimed', COALESCE(v_onboarding_bonus_claimed, false)));
  END IF;
  
  v_user_data := calculate_user_tickets(p_user_id, v_giveaway.id);
  
  RETURN jsonb_build_object(
    'giveaway', jsonb_build_object(
        'id', v_giveaway.id,
        'name', v_giveaway.name,
        'prize_title', v_giveaway.prize_title,
        'is_active', v_giveaway.is_active,
        'ends_at', v_giveaway.ends_at
    ),
    'user_data', v_user_data || jsonb_build_object('onboarding_bonus_claimed', COALESCE(v_onboarding_bonus_claimed, false))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
