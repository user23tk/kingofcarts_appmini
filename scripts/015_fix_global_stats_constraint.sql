-- Fix for global stats table
-- Ensures single row constraint is properly enforced

-- Drop existing constraint if exists
ALTER TABLE global_stats DROP CONSTRAINT IF EXISTS single_row_constraint;

-- Add unique constraint on id to ensure single row
ALTER TABLE global_stats ADD CONSTRAINT single_row_constraint UNIQUE (id);

-- Ensure only one row exists
DELETE FROM global_stats WHERE id != '00000000-0000-0000-0000-000000000001';

-- Insert or update the single row
INSERT INTO global_stats (id, total_users, total_chapters_completed, total_interactions, total_pp_earned)
VALUES ('00000000-0000-0000-0000-000000000001', 0, 0, 0, 0)
ON CONFLICT (id) DO UPDATE
SET last_updated = NOW();
