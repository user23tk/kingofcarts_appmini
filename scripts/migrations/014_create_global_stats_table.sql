-- Global statistics table
-- Tracks overall bot usage and engagement metrics

CREATE TABLE IF NOT EXISTS global_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_users INTEGER NOT NULL DEFAULT 0,
  total_chapters_completed INTEGER NOT NULL DEFAULT 0,
  total_interactions INTEGER NOT NULL DEFAULT 0,
  total_pp_earned BIGINT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial row if not exists
INSERT INTO global_stats (id, total_users, total_chapters_completed, total_interactions, total_pp_earned)
VALUES ('00000000-0000-0000-0000-000000000001', 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Functions to update global stats
CREATE OR REPLACE FUNCTION increment_global_users()
RETURNS void AS $$
BEGIN
  UPDATE global_stats 
  SET total_users = total_users + 1,
      last_updated = NOW()
  WHERE id = '00000000-0000-0000-0000-000000000001';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_global_interactions()
RETURNS void AS $$
BEGIN
  UPDATE global_stats 
  SET total_interactions = total_interactions + 1,
      last_updated = NOW()
  WHERE id = '00000000-0000-0000-0000-000000000001';
END;
$$ LANGUAGE plpgsql;
