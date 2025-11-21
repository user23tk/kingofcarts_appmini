-- Create all missing RPC functions for event system

-- Function: deactivate_expired_events
-- Automatically deactivates events that have passed their end date
CREATE OR REPLACE FUNCTION deactivate_expired_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE themes
  SET is_active = false
  WHERE is_event = true
    AND is_active = true
    AND event_end_date IS NOT NULL
    AND event_end_date < NOW();
END;
$$;

-- Function: get_active_event
-- Returns the currently active event
CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  event_emoji text,
  pp_multiplier numeric,
  event_start_date timestamp with time zone,
  event_end_date timestamp with time zone,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First deactivate expired events
  PERFORM deactivate_expired_events();
  
  -- Return active event
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.description,
    t.event_emoji,
    t.pp_multiplier,
    t.event_start_date,
    t.event_end_date,
    t.is_active
  FROM themes t
  WHERE t.is_event = true
    AND t.is_active = true
  LIMIT 1;
END;
$$;

-- Function: get_event_leaderboard
-- Returns leaderboard for a specific event
CREATE OR REPLACE FUNCTION get_event_leaderboard(p_theme_name text, p_limit integer DEFAULT 100)
RETURNS TABLE (
  user_id text,
  total_pp integer,
  chapters_completed integer,
  rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.user_id,
    el.total_pp,
    el.chapters_completed,
    el.rank
  FROM event_leaderboard el
  WHERE el.theme = p_theme_name
  ORDER BY el.rank ASC
  LIMIT p_limit;
END;
$$;

-- Function: get_user_event_rank
-- Returns a specific user's rank in an event
CREATE OR REPLACE FUNCTION get_user_event_rank(p_user_id text, p_theme_name text)
RETURNS TABLE (
  user_id text,
  total_pp integer,
  chapters_completed integer,
  rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.user_id,
    el.total_pp,
    el.chapters_completed,
    el.rank
  FROM event_leaderboard el
  WHERE el.user_id = p_user_id
    AND el.theme = p_theme_name;
END;
$$;

-- Function: update_event_leaderboard_atomic
-- Atomically updates event leaderboard with row-level locking
CREATE OR REPLACE FUNCTION update_event_leaderboard_atomic(
  p_user_id text,
  p_theme_name text,
  p_pp_gained integer,
  p_chapter_completed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_pp integer;
  v_current_chapters integer;
BEGIN
  -- Lock the row for update or insert if doesn't exist
  SELECT total_pp, chapters_completed INTO v_current_pp, v_current_chapters
  FROM event_leaderboard
  WHERE user_id = p_user_id AND theme = p_theme_name
  FOR UPDATE;
  
  IF FOUND THEN
    -- Update existing record
    UPDATE event_leaderboard
    SET 
      total_pp = total_pp + p_pp_gained,
      chapters_completed = CASE 
        WHEN p_chapter_completed THEN chapters_completed + 1 
        ELSE chapters_completed 
      END,
      last_updated = NOW()
    WHERE user_id = p_user_id AND theme = p_theme_name;
  ELSE
    -- Insert new record
    INSERT INTO event_leaderboard (user_id, theme, total_pp, chapters_completed, last_updated)
    VALUES (
      p_user_id,
      p_theme_name,
      p_pp_gained,
      CASE WHEN p_chapter_completed THEN 1 ELSE 0 END,
      NOW()
    );
  END IF;
  
  -- Recalculate ranks for this event
  WITH ranked_users AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY total_pp DESC, chapters_completed DESC, last_updated ASC) as new_rank
    FROM event_leaderboard
    WHERE theme = p_theme_name
  )
  UPDATE event_leaderboard el
  SET rank = ru.new_rank
  FROM ranked_users ru
  WHERE el.user_id = ru.user_id AND el.theme = p_theme_name;
END;
$$;

-- Function: complete_chapter_atomic
-- Atomically completes a chapter, updates PP, and event leaderboard
CREATE OR REPLACE FUNCTION complete_chapter_atomic(
  p_user_id uuid,
  p_theme_key text,
  p_chapter_number integer,
  p_pp_gained integer,
  p_is_event boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_new_total_pp integer;
BEGIN
  -- Start transaction
  BEGIN
    -- Update user_progress with new PP and chapter
    UPDATE user_progress
    SET 
      total_pp = COALESCE(total_pp, 0) + p_pp_gained,
      current_chapter = p_chapter_number + 1,
      total_chapters_completed = COALESCE(total_chapters_completed, 0) + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING total_pp INTO v_new_total_pp;
    
    -- If this is an event, update event leaderboard
    IF p_is_event THEN
      PERFORM update_event_leaderboard_atomic(
        p_user_id::text,
        p_theme_key,
        p_pp_gained,
        true
      );
    END IF;
    
    -- Build result
    v_result = jsonb_build_object(
      'success', true,
      'new_total_pp', v_new_total_pp,
      'pp_gained', p_pp_gained,
      'next_chapter', p_chapter_number + 1
    );
    
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback on error
      RAISE;
  END;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deactivate_expired_events() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_active_event() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_event_leaderboard(text, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_event_rank(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_event_leaderboard_atomic(text, text, integer, boolean) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION complete_chapter_atomic(uuid, text, integer, integer, boolean) TO authenticated, anon;
