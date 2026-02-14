-- ==============================================================================
-- KING OF CARTS - COMPLETE DATABASE SCHEMA
-- Version: 4.5.0 (Consolidated & Type Aligned & Idempotent & Auto-Migrating & Rank Renamed)
-- Generated: February 2026
-- 
-- ORDER OF EXECUTION:
-- 1. Extensions
-- 2. Logic Functions (Timestamp update)
-- 3. Core Tables
-- 4. Event System Tables
-- 5. Giveaway System Tables
-- 6. Security & Audit Tables
-- 7. RLS Policies
-- 8. Core RPC Functions
-- 9. Event RPC Functions
-- 10. Giveaway RPC Functions
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. COMMON LOGIC FUNCTIONS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. CORE TABLES

-- 3.1 USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  telegram_id BIGINT UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  language_code TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  referral_source TEXT
);

-- Backfill missing columns for users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='photo_url') THEN
        ALTER TABLE public.users ADD COLUMN photo_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='referral_source') THEN
        ALTER TABLE public.users ADD COLUMN referral_source TEXT;
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.2 THEMES
CREATE TABLE IF NOT EXISTS public.themes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- UUID matches Prod
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  emoji TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  required_level INTEGER DEFAULT 1,
  config JSONB DEFAULT '{}'::jsonb,
  -- Event specific fields
  is_event BOOLEAN DEFAULT FALSE,
  event_start_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  event_emoji TEXT,
  pp_multiplier NUMERIC DEFAULT 1.0,
  total_chapters INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill missing columns for themes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='themes' AND column_name='total_chapters') THEN
        ALTER TABLE public.themes ADD COLUMN total_chapters INTEGER DEFAULT 0;
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_themes_updated_at ON public.themes;
CREATE TRIGGER update_themes_updated_at
BEFORE UPDATE ON public.themes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.3 USER PROGRESS
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  telegram_id BIGINT, -- copy for easier joins
  current_theme TEXT DEFAULT 'fantasy',
  completed_themes TEXT[] DEFAULT ARRAY[]::TEXT[],
  themes_completed INTEGER DEFAULT 0,
  
  -- Progress tracking
  total_chapters_completed INTEGER DEFAULT 0,
  last_chapter_completed_at TIMESTAMPTZ,
  
  -- Gamification
  current_rank INTEGER DEFAULT 0, -- RENAMED from rank
  total_pp INTEGER DEFAULT 0,
  energy INTEGER DEFAULT 100,
  max_energy INTEGER DEFAULT 100,
  energy_refill_at TIMESTAMPTZ,
  
  -- Detailed progress per theme
  theme_progress JSONB DEFAULT '{}'::jsonb,
  
  -- Flags
  onboarding_bonus_claimed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rename rank column if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_progress' AND column_name='rank') THEN
        ALTER TABLE public.user_progress RENAME COLUMN "rank" TO current_rank;
    END IF;
    -- Ensure current_rank exists (if table was just created it has it, if renamed it has it, if neither...)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_progress' AND column_name='current_rank') THEN
         ALTER TABLE public.user_progress ADD COLUMN current_rank INTEGER DEFAULT 0;
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON public.user_progress;
CREATE TRIGGER update_user_progress_updated_at
BEFORE UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_progress_total_pp ON user_progress(total_pp DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_chapters ON user_progress(total_chapters_completed DESC);

-- 3.4 STORY CHAPTERS
CREATE TABLE IF NOT EXISTS public.story_chapters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  theme_id UUID REFERENCES public.themes(id), -- UUID matches Prod
  chapter_number INTEGER NOT NULL,
  title TEXT,
  content JSONB, -- stores scenes, choices
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(theme_id, chapter_number)
);

-- 3.5 STORY SESSIONS
CREATE TABLE IF NOT EXISTS public.story_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  theme_id UUID REFERENCES public.themes(id), -- UUID matches Prod
  status TEXT DEFAULT 'active', -- active, completed, failed
  current_chapter INTEGER DEFAULT 1,
  total_chapters INTEGER DEFAULT 5,
  context JSONB DEFAULT '{}'::jsonb, -- dynamic story state
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_story_sessions_updated_at ON public.story_sessions;
CREATE TRIGGER update_story_sessions_updated_at
BEFORE UPDATE ON public.story_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. EVENT SYSTEM TABLES

-- 4.1 EVENTS (Legacy/Alternative table - kept for compatibility but Themes is main driver)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  type TEXT DEFAULT 'standard',
  config JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.2 EVENT LEADERBOARD (Dedicated table for event-only performance)
CREATE TABLE IF NOT EXISTS public.event_leaderboard (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL, -- Logical link to theme key (likely name/slug)
  event_id UUID, -- Optional link to themes.id or events.id
  total_pp INTEGER DEFAULT 0,
  chapters_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, theme)
);

CREATE INDEX IF NOT EXISTS idx_event_leaderboard_ranking ON event_leaderboard(theme, total_pp DESC, chapters_completed DESC);

-- 5. GIVEAWAY SYSTEM TABLES

-- Ticket Sequence
CREATE SEQUENCE IF NOT EXISTS giveaway_ticket_numbers START 1;

-- 5.1 GIVEAWAYS
CREATE TABLE IF NOT EXISTS public.giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID REFERENCES themes(id) ON DELETE SET NULL, -- UUID matches Prod
  name TEXT NOT NULL,
  description TEXT,
  pp_per_ticket INTEGER NOT NULL DEFAULT 100,
  tickets_per_entry INTEGER NOT NULL DEFAULT 1,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  prize_title TEXT NOT NULL,
  prize_type TEXT NOT NULL DEFAULT 'telegram_gift',
  prize_description TEXT,
  prize_image_url TEXT,
  prize_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT giveaways_valid_dates CHECK (ends_at > starts_at)
);

DROP TRIGGER IF EXISTS update_giveaways_updated_at ON public.giveaways;
CREATE TRIGGER update_giveaways_updated_at
BEFORE UPDATE ON public.giveaways
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways(is_active) WHERE is_active = true;

-- 5.2 GIVEAWAY ENTRIES
CREATE TABLE IF NOT EXISTS public.giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT giveaway_entries_unique_ticket UNIQUE (giveaway_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id);

-- 5.3 GIVEAWAY RESULTS
CREATE TABLE IF NOT EXISTS public.giveaway_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  winner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winning_ticket_number BIGINT NOT NULL,
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  drawn_by_admin_id UUID REFERENCES users(id),
  notes TEXT,
  
  CONSTRAINT giveaway_results_one_winner UNIQUE (giveaway_id)
);

-- 6. SECURITY & AUDIT TABLES

-- 6.1 RATE LIMITS (User based)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 1,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  UNIQUE(user_id, date)
);

-- 6.2 GLOBAL STATS
CREATE TABLE IF NOT EXISTS public.global_stats (
  stat_name TEXT PRIMARY KEY,
  stat_value BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.3 AUDIT LOGS (General security)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- 6.4 PP AUDIT (Points tracking)
CREATE TABLE IF NOT EXISTS public.pp_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  scene_index INTEGER NOT NULL,
  choice_id TEXT NOT NULL,
  pp_gained INTEGER NOT NULL,
  session_total_pp INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pp_audit_user_id ON pp_audit(user_id);

-- 7. RLS POLICIES

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
DROP POLICY IF EXISTS "Public read users" ON public.users;
CREATE POLICY "Public read users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read user_progress" ON public.user_progress;
CREATE POLICY "Public read user_progress" ON public.user_progress FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read themes" ON public.themes;
CREATE POLICY "Public read themes" ON public.themes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read giveaways" ON public.giveaways;
CREATE POLICY "Public read giveaways" ON public.giveaways FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read giveaway_entries" ON public.giveaway_entries;
CREATE POLICY "Public read giveaway_entries" ON public.giveaway_entries FOR SELECT USING (true);

-- User Write Policies (Self)
DROP POLICY IF EXISTS "User update own profile" ON public.users;
CREATE POLICY "User update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "User update own progress" ON public.user_progress;
CREATE POLICY "User update own progress" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User manage sessions" ON public.story_sessions;
CREATE POLICY "User manage sessions" ON public.story_sessions USING (auth.uid() = user_id);

-- System/Admin Policies usually handled by Service Role (bypasses RLS) or specific admin policies
-- Giveaway Entry Creation (User can enter)
DROP POLICY IF EXISTS "User create giveaway entry" ON public.giveaway_entries;
CREATE POLICY "User create giveaway entry" ON public.giveaway_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Audit Logs (Admin read only, System insert)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read logs" ON public.audit_logs;
CREATE POLICY "Admin read logs" ON public.audit_logs FOR SELECT USING (false); -- Implicitly allows service role

DROP POLICY IF EXISTS "System insert logs" ON public.audit_logs;
CREATE POLICY "System insert logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- 8. CORE RPC FUNCTIONS

-- 8.1 Get User Rank
DROP FUNCTION IF EXISTS public.get_user_rank(uuid);
CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rank integer;
BEGIN
  SELECT count(*) + 1
  INTO v_rank
  FROM public.user_progress
  WHERE total_chapters_completed > (
    SELECT total_chapters_completed
    FROM public.user_progress
    WHERE user_id = p_user_id
  );
  
  -- Optimization: Update cached rank
  UPDATE public.user_progress
  SET current_rank = v_rank
  WHERE user_id = p_user_id;
  
  RETURN v_rank;
END;
$$;

-- 8.2 Get Global Leaderboard
DROP FUNCTION IF EXISTS public.get_leaderboard(integer);
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 100)
RETURNS TABLE (
  user_id uuid,
  username text,
  photo_url text,
  total_chapters_completed integer,
  total_pp integer,
  current_rank integer -- RENAMED
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    u.username,
    u.photo_url,
    up.total_chapters_completed,
    up.total_pp,
    up.current_rank -- RENAMED
  FROM public.user_progress up
  JOIN public.users u ON u.id = up.user_id
  ORDER BY up.total_pp DESC, up.total_chapters_completed DESC
  LIMIT limit_count;
END;
$$;

-- 8.3 Rate Limiting Check
DROP FUNCTION IF EXISTS check_rate_limit(uuid, integer, boolean);
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_daily_limit INTEGER,
  p_should_count BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Insert or update rate limit record
  INSERT INTO rate_limits (user_id, date, request_count, last_request_at)
  VALUES (p_user_id, CURRENT_DATE, CASE WHEN p_should_count THEN 1 ELSE 0 END, NOW())
  ON CONFLICT (user_id, date)
  DO UPDATE SET 
    request_count = rate_limits.request_count + CASE WHEN p_should_count THEN 1 ELSE 0 END,
    last_request_at = NOW()
  RETURNING request_count INTO v_current_count;

  IF v_current_count > p_daily_limit AND p_should_count THEN
    v_allowed := FALSE;
  ELSE
    v_allowed := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count,
    'limit', p_daily_limit
  );
END;
$$;

-- 9. EVENT RPC FUNCTIONS

-- 9.1 Get Active Event
DROP FUNCTION IF EXISTS get_active_event();
CREATE OR REPLACE FUNCTION get_active_event()
RETURNS TABLE(
    theme_id TEXT, -- Changed to TEXT to return ID stringified
    theme_name TEXT,
    theme_description TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    emoji TEXT,
    pp_multiplier NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id::TEXT,
        COALESCE(t.title, t.name)::TEXT,
        t.description::TEXT,
        t.event_start_date,
        t.event_end_date,
        t.event_emoji,
        t.pp_multiplier
    FROM themes t
    WHERE t.is_event = true
      AND t.is_active = true
      AND (t.event_start_date IS NULL OR t.event_start_date <= NOW())
      AND (t.event_end_date IS NULL OR t.event_end_date > NOW())
    ORDER BY t.event_start_date DESC NULLS LAST
    LIMIT 1;
END;
$$;

-- 9.2 Get Event Leaderboard (V2 Fixed)
DROP FUNCTION IF EXISTS get_event_leaderboard_v2(text, integer);
CREATE OR REPLACE FUNCTION get_event_leaderboard_v2(
    p_theme TEXT, 
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
    user_id UUID,
    telegram_id BIGINT,
    first_name TEXT,
    username TEXT,
    total_pp INTEGER,
    chapters_completed INTEGER,
    rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 9.3 Update Event Leaderboard Atomic
DROP FUNCTION IF EXISTS update_event_leaderboard_atomic(uuid, text, integer);
CREATE OR REPLACE FUNCTION update_event_leaderboard_atomic(
    p_user_id UUID,
    p_theme TEXT,
    p_pp_gained INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 9.4 Get User Event Stats
DROP FUNCTION IF EXISTS get_user_event_stats(uuid, text);
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

-- 9.5 Deactivate Expired Events
DROP FUNCTION IF EXISTS deactivate_expired_events();
CREATE OR REPLACE FUNCTION deactivate_expired_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE themes
  SET is_active = false,
      updated_at = NOW()
  WHERE is_event = true
    AND is_active = true
    AND event_end_date IS NOT NULL
    AND event_end_date <= NOW();
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;

-- 10. GIVEAWAY RPC FUNCTIONS
-- 10.1 Calculate User Tickets
DROP FUNCTION IF EXISTS calculate_user_tickets(uuid, uuid);
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
  SELECT COALESCE(total_pp, 0) INTO v_total_pp
  FROM user_progress
  WHERE user_id = p_user_id;
  
  SELECT pp_per_ticket INTO v_pp_per_ticket
  FROM giveaways
  WHERE id = p_giveaway_id;
  
  IF v_pp_per_ticket IS NULL THEN
    RETURN jsonb_build_object('error', 'Giveaway not found', 'success', false);
  END IF;
  
  v_tickets_total := FLOOR(v_total_pp::NUMERIC / v_pp_per_ticket);
  
  SELECT COUNT(*) INTO v_tickets_used
  FROM giveaway_entries
  WHERE giveaway_id = p_giveaway_id AND user_id = p_user_id;
  
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

-- 10.2 Allocate Ticket
DROP FUNCTION IF EXISTS allocate_giveaway_ticket(uuid, uuid);
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
  SELECT id, is_active, ends_at, pp_per_ticket
  INTO v_giveaway
  FROM giveaways
  WHERE id = p_giveaway_id;
  
  IF v_giveaway.id IS NULL OR NOT v_giveaway.is_active OR v_giveaway.ends_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive giveaway');
  END IF;
  
  v_ticket_data := calculate_user_tickets(p_user_id, p_giveaway_id);
  
  IF (v_ticket_data->>'tickets_available')::INTEGER < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tickets available');
  END IF;
  
  v_ticket_number := nextval('giveaway_ticket_numbers');
  
  INSERT INTO giveaway_entries (giveaway_id, user_id, ticket_number)
  VALUES (p_giveaway_id, p_user_id, v_ticket_number);
  
  RETURN jsonb_build_object(
    'success', true,
    'ticket_number', v_ticket_number,
    'new_balance', calculate_user_tickets(p_user_id, p_giveaway_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.3 Draw Winner
DROP FUNCTION IF EXISTS draw_giveaway_winner(uuid, uuid);
CREATE OR REPLACE FUNCTION draw_giveaway_winner(
  p_giveaway_id UUID,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_winner RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM giveaway_results WHERE giveaway_id = p_giveaway_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Winner already drawn');
  END IF;
  
  SELECT ge.user_id, ge.ticket_number
  INTO v_winner
  FROM giveaway_entries ge
  WHERE ge.giveaway_id = p_giveaway_id
  ORDER BY random()
  LIMIT 1;
  
  IF v_winner IS NULL THEN
     RETURN jsonb_build_object('success', false, 'error', 'No entries');
  END IF;
  
  INSERT INTO giveaway_results (giveaway_id, winner_user_id, winning_ticket_number, drawn_by_admin_id)
  VALUES (p_giveaway_id, v_winner.user_id, v_winner.ticket_number, p_admin_user_id);
  
  UPDATE giveaways SET is_active = false WHERE id = p_giveaway_id;
  
  RETURN jsonb_build_object('success', true, 'winner_user_id', v_winner.user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10.4 Get Active Giveaway For User
DROP FUNCTION IF EXISTS get_active_giveaway_for_user(uuid);
CREATE OR REPLACE FUNCTION get_active_giveaway_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_giveaway RECORD;
  v_user_data JSONB;
  v_winner RECORD;
  v_onboarding_bonus_claimed BOOLEAN;
BEGIN
  -- Get active giveaway
  SELECT g.*, t.name as theme_name, t.title as theme_title, t.event_emoji
  INTO v_giveaway
  FROM giveaways g
  LEFT JOIN themes t ON t.id = g.theme_id
  ORDER BY g.is_active DESC, g.created_at DESC
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

-- ==============================================================================
-- END OF SCHEMA
-- Version: 4.5.0 - Consolidated February 2026
-- ==============================================================================

- -   M i g r a t i o n :   A d d   d e a c t i v a t e _ e x p i r e d _ g i v e a w a y s   R P C 
 
 - -   D a t e :   2 0 2 6 - 0 2 - 0 7 
 
 
 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   d e a c t i v a t e _ e x p i r e d _ g i v e a w a y s ( ) 
 
 R E T U R N S   I N T E G E R 
 
 L A N G U A G E   p l p g s q l 
 
 S E C U R I T Y   D E F I N E R 
 
 A S   $ $ 
 
 D E C L A R E 
 
         v _ c o u n t   I N T E G E R ; 
 
 B E G I N 
 
         W I T H   d e a c t i v a t e d   A S   ( 
 
                 U P D A T E   g i v e a w a y s 
 
                 S E T   i s _ a c t i v e   =   f a l s e 
 
                 W H E R E   i s _ a c t i v e   =   t r u e 
 
                     A N D   e n d s _ a t   <   N O W ( ) 
 
                 R E T U R N I N G   i d 
 
         ) 
 
         S E L E C T   C O U N T ( * )   I N T O   v _ c o u n t   F R O M   d e a c t i v a t e d ; 
 
 
 
         - -   L o g   i f   a n y   g i v e a w a y s   w e r e   d e a c t i v a t e d 
 
         I F   v _ c o u n t   >   0   T H E N 
 
                 I N S E R T   I N T O   a u d i t _ l o g s   ( l e v e l ,   c o n t e x t ,   m e s s a g e ,   m e t a d a t a ) 
 
                 V A L U E S   ( ' i n f o ' ,   ' c r o n - g i v e a w a y s ' ,   ' D e a c t i v a t e d   e x p i r e d   g i v e a w a y s ' ,   j s o n b _ b u i l d _ o b j e c t ( ' c o u n t ' ,   v _ c o u n t ) ) ; 
 
         E N D   I F ; 
 
 
 
         R E T U R N   v _ c o u n t ; 
 
 E N D ; 
 
 $ $ ; 
 
 