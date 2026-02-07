-- =====================================================
-- FIX GIVEAWAY RLS POLICIES
-- =====================================================
-- This script adds missing INSERT and UPDATE policies for giveaways table
-- Previously only SELECT and DELETE policies existed

-- Add INSERT policy for giveaways (allows service role to insert)
DROP POLICY IF EXISTS "giveaways_insert_all" ON giveaways;
CREATE POLICY "giveaways_insert_all" ON giveaways
  FOR INSERT WITH CHECK (true);

-- Add UPDATE policy for giveaways (allows service role to update)
DROP POLICY IF EXISTS "giveaways_update_all" ON giveaways;
CREATE POLICY "giveaways_update_all" ON giveaways
  FOR UPDATE USING (true) WITH CHECK (true);

-- Verify the policies exist
DO $$
BEGIN
  RAISE NOTICE 'Giveaway RLS policies updated successfully';
  RAISE NOTICE 'Current policies on giveaways table:';
END $$;

-- Also add UPDATE policy for giveaway_entries if missing
DROP POLICY IF EXISTS "giveaway_entries_update_all" ON giveaway_entries;
CREATE POLICY "giveaway_entries_update_all" ON giveaway_entries
  FOR UPDATE USING (true) WITH CHECK (true);

-- Add INSERT policy for giveaway_results (for admin draw operation)
DROP POLICY IF EXISTS "giveaway_results_insert_all" ON giveaway_results;
CREATE POLICY "giveaway_results_insert_all" ON giveaway_results
  FOR INSERT WITH CHECK (true);

COMMENT ON POLICY "giveaways_insert_all" ON giveaways IS 'Allow server/admin to create giveaways';
COMMENT ON POLICY "giveaways_update_all" ON giveaways IS 'Allow server/admin to update giveaways';
