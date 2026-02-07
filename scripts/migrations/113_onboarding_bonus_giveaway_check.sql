-- =====================================================
-- ONBOARDING BONUS - GIVEAWAY CHECK
-- =====================================================
-- Modifica le funzioni di onboarding bonus per verificare
-- che ci sia un giveaway attivo prima di assegnare il bonus
-- 
-- Condizioni per ricevere il bonus 200PP:
-- 1. Deve esistere un giveaway attivo (is_active = true AND ends_at > NOW())
-- 2. L'utente NON deve aver già reclamato il bonus
-- 3. L'utente deve avere 0 PP (o non esistere in user_progress)
-- =====================================================

-- 1. Funzione helper per verificare se esiste un giveaway attivo
CREATE OR REPLACE FUNCTION is_giveaway_active()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM giveaways 
    WHERE is_active = true 
      AND ends_at > NOW()
      AND starts_at <= NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_giveaway_active IS 'Verifica se esiste un giveaway attivo in corso';

-- 2. Aggiorna check_onboarding_bonus_status per includere verifica giveaway
CREATE OR REPLACE FUNCTION check_onboarding_bonus_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_bonus_claimed BOOLEAN;
  v_total_pp INTEGER;
  v_giveaway_active BOOLEAN;
BEGIN
  -- Verifica se c'è un giveaway attivo
  v_giveaway_active := is_giveaway_active();
  
  SELECT onboarding_bonus_claimed, total_pp
  INTO v_bonus_claimed, v_total_pp
  FROM user_progress
  WHERE user_id = p_user_id;
  
  -- User doesn't have progress yet
  IF v_bonus_claimed IS NULL THEN
    RETURN jsonb_build_object(
      'can_claim', v_giveaway_active, -- può claimare SOLO se giveaway attivo
      'already_claimed', false,
      'total_pp', 0,
      'giveaway_active', v_giveaway_active,
      'reason', CASE 
        WHEN NOT v_giveaway_active THEN 'no_active_giveaway'
        ELSE NULL
      END
    );
  END IF;
  
  -- User exists, check conditions
  RETURN jsonb_build_object(
    'can_claim', (NOT v_bonus_claimed) AND v_giveaway_active AND (COALESCE(v_total_pp, 0) = 0),
    'already_claimed', v_bonus_claimed,
    'total_pp', COALESCE(v_total_pp, 0),
    'giveaway_active', v_giveaway_active,
    'reason', CASE 
      WHEN v_bonus_claimed THEN 'bonus_already_claimed'
      WHEN NOT v_giveaway_active THEN 'no_active_giveaway'
      WHEN COALESCE(v_total_pp, 0) > 0 THEN 'user_has_pp'
      ELSE NULL
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_onboarding_bonus_status IS 'Verifica se l''utente può reclamare il bonus onboarding (richiede giveaway attivo e 0 PP)';

-- 3. Aggiorna grant_onboarding_bonus per verificare giveaway attivo e 0 PP
CREATE OR REPLACE FUNCTION grant_onboarding_bonus(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_total_pp INTEGER;
  v_bonus_claimed BOOLEAN;
  v_giveaway_active BOOLEAN;
BEGIN
  -- Verifica se c'è un giveaway attivo
  v_giveaway_active := is_giveaway_active();
  
  IF NOT v_giveaway_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_active_giveaway',
      'message', 'Nessun giveaway attivo al momento'
    );
  END IF;

  -- Lock row to prevent race conditions
  SELECT total_pp, onboarding_bonus_claimed
  INTO v_current_total_pp, v_bonus_claimed
  FROM user_progress
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- If user doesn't exist in user_progress, create entry
  IF v_current_total_pp IS NULL THEN
    INSERT INTO user_progress (user_id, current_theme, total_pp, onboarding_bonus_claimed)
    VALUES (p_user_id, 'horror', 0, false)
    ON CONFLICT (user_id) DO NOTHING;
    
    SELECT total_pp, onboarding_bonus_claimed
    INTO v_current_total_pp, v_bonus_claimed
    FROM user_progress
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Nuovo utente, imposta a 0
    v_current_total_pp := 0;
  END IF;
  
  -- Check if bonus already claimed
  IF v_bonus_claimed THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'bonus_already_claimed',
      'total_pp', v_current_total_pp,
      'message', 'Bonus già reclamato in precedenza'
    );
  END IF;
  
  -- Check if user has 0 PP (new user or user who hasn't played)
  IF COALESCE(v_current_total_pp, 0) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'user_has_pp',
      'total_pp', v_current_total_pp,
      'message', 'Il bonus è riservato agli utenti con 0 PP'
    );
  END IF;
  
  -- All conditions met: Apply bonus
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
    'giveaway_onboarding_bonus',
    200,
    200
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', 200,
    'new_total_pp', 200,
    'message', 'Bonus 200 PP assegnato con successo!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION grant_onboarding_bonus IS 'Assegna +200 PP bonus onboarding (richiede giveaway attivo e utente con 0 PP)';

-- 4. Query di verifica
DO $$
BEGIN
  RAISE NOTICE '✅ Funzioni onboarding bonus aggiornate';
  RAISE NOTICE '   - is_giveaway_active(): verifica se esiste giveaway attivo';
  RAISE NOTICE '   - check_onboarding_bonus_status(): ora verifica giveaway + 0 PP';
  RAISE NOTICE '   - grant_onboarding_bonus(): ora richiede giveaway attivo + 0 PP';
END $$;
