-- =====================================================
-- GIVEAWAY MVP - SCHEMA TABLES
-- =====================================================
-- This script creates the necessary tables for the giveaway system
-- Run this FIRST before the RPC functions script

-- 1. Create sequence for ticket numbering (atomic, race-condition safe)
CREATE SEQUENCE IF NOT EXISTS giveaway_ticket_numbers START 1;

-- 2. Create giveaways table
CREATE TABLE IF NOT EXISTS public.giveaways (
  -- Identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to event theme (optional)
  theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
  
  -- Contest metadata
  name TEXT NOT NULL,
  description TEXT,
  
  -- Ticket configuration
  pp_per_ticket INTEGER NOT NULL DEFAULT 100,
  tickets_per_entry INTEGER NOT NULL DEFAULT 1,
  
  -- Contest dates
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Prize information (for Mini App UI)
  prize_title TEXT NOT NULL,
  prize_type TEXT NOT NULL DEFAULT 'telegram_gift',
  prize_description TEXT,
  prize_image_url TEXT,
  prize_link TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT giveaways_valid_dates CHECK (ends_at > starts_at),
  CONSTRAINT giveaways_positive_pp_per_ticket CHECK (pp_per_ticket > 0),
  CONSTRAINT giveaways_valid_prize_type CHECK (prize_type IN ('telegram_gift', 'product_box', 'stars', 'premium', 'other'))
);

-- Indexes for giveaways
CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_giveaways_dates ON giveaways(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_giveaways_theme ON giveaways(theme_id);

-- 3. Create giveaway_entries table (ticket entries)
CREATE TABLE IF NOT EXISTS public.giveaway_entries (
  -- Identifier
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Ticket number (unique per giveaway)
  ticket_number BIGINT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: unique ticket number per giveaway
  CONSTRAINT giveaway_entries_unique_ticket UNIQUE (giveaway_id, ticket_number)
);

-- Indexes for giveaway_entries
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway ON giveaway_entries(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_user ON giveaway_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway_user ON giveaway_entries(giveaway_id, user_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_entries_ticket ON giveaway_entries(giveaway_id, ticket_number);

-- 4. Create giveaway_results table (winners)
CREATE TABLE IF NOT EXISTS public.giveaway_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  winner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winning_ticket_number BIGINT NOT NULL,
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  drawn_by_admin_id UUID REFERENCES users(id),
  notes TEXT,
  
  -- Only one winner per giveaway (MVP)
  CONSTRAINT giveaway_results_one_winner UNIQUE (giveaway_id)
);

-- Indexes for giveaway_results
CREATE INDEX IF NOT EXISTS idx_giveaway_results_giveaway ON giveaway_results(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_giveaway_results_winner ON giveaway_results(winner_user_id);

-- 5. Add onboarding_bonus_claimed to user_progress
ALTER TABLE public.user_progress
ADD COLUMN IF NOT EXISTS onboarding_bonus_claimed BOOLEAN NOT NULL DEFAULT false;

-- Index for onboarding bonus queries
CREATE INDEX IF NOT EXISTS idx_user_progress_onboarding_unclaimed 
ON user_progress(onboarding_bonus_claimed) 
WHERE onboarding_bonus_claimed = false;

-- 6. Trigger to prevent pp_per_ticket change when giveaway is active
CREATE OR REPLACE FUNCTION prevent_pp_per_ticket_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_active = true AND NEW.pp_per_ticket != OLD.pp_per_ticket THEN
    RAISE EXCEPTION 'Cannot change pp_per_ticket while giveaway is active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_pp_per_ticket_change ON giveaways;
CREATE TRIGGER check_pp_per_ticket_change
BEFORE UPDATE ON giveaways
FOR EACH ROW
EXECUTE FUNCTION prevent_pp_per_ticket_change();

-- 7. Trigger to update updated_at on giveaways
CREATE OR REPLACE FUNCTION update_giveaways_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS giveaways_updated_at ON giveaways;
CREATE TRIGGER giveaways_updated_at
BEFORE UPDATE ON giveaways
FOR EACH ROW
EXECUTE FUNCTION update_giveaways_updated_at();

-- 8. Enable RLS on new tables
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for giveaways (read-only for authenticated users)
DROP POLICY IF EXISTS "giveaways_select_all" ON giveaways;
CREATE POLICY "giveaways_select_all" ON giveaways
  FOR SELECT USING (true);

-- RLS Policies for giveaway_entries
DROP POLICY IF EXISTS "giveaway_entries_select_all" ON giveaway_entries;
CREATE POLICY "giveaway_entries_select_all" ON giveaway_entries
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "giveaway_entries_insert_own" ON giveaway_entries;
CREATE POLICY "giveaway_entries_insert_own" ON giveaway_entries
  FOR INSERT WITH CHECK (true);

-- RLS Policies for giveaway_results
DROP POLICY IF EXISTS "giveaway_results_select_all" ON giveaway_results;
CREATE POLICY "giveaway_results_select_all" ON giveaway_results
  FOR SELECT USING (true);

COMMENT ON TABLE public.giveaways IS 'Giveaway contests with ticket-based participation';
COMMENT ON TABLE public.giveaway_entries IS 'User ticket entries for giveaways';
COMMENT ON TABLE public.giveaway_results IS 'Giveaway winners and extraction results';
COMMENT ON COLUMN public.user_progress.onboarding_bonus_claimed IS 'Whether user has claimed the +200 PP onboarding bonus';
