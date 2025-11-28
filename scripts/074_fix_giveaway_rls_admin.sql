-- Fix RLS policies to allow admin operations on giveaway tables
-- Run this script to enable delete operations from debug panel

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Allow admin delete on giveaways" ON giveaways;
DROP POLICY IF EXISTS "Allow admin delete on giveaway_entries" ON giveaway_entries;
DROP POLICY IF EXISTS "Allow admin delete on giveaway_results" ON giveaway_results;

-- Create policies that allow service role to delete
-- Note: Service role bypasses RLS by default, but we add explicit policies for safety

-- For giveaways table - allow all operations for authenticated service
CREATE POLICY "Allow admin delete on giveaways" 
ON giveaways 
FOR DELETE 
TO authenticated, service_role, anon
USING (true);

-- For giveaway_entries table
CREATE POLICY "Allow admin delete on giveaway_entries" 
ON giveaway_entries 
FOR DELETE 
TO authenticated, service_role, anon
USING (true);

-- For giveaway_results table  
CREATE POLICY "Allow admin delete on giveaway_results" 
ON giveaway_results 
FOR DELETE 
TO authenticated, service_role, anon
USING (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE tablename IN ('giveaways', 'giveaway_entries', 'giveaway_results')
ORDER BY tablename, policyname;
