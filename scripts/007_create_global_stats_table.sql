-- Create global_stats table
CREATE TABLE IF NOT EXISTS global_stats (
  stat_name TEXT PRIMARY KEY,
  stat_value BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default stats
INSERT INTO global_stats (stat_name, stat_value) VALUES
  ('total_users', 0),
  ('total_interactions', 0),
  ('total_chapters_completed', 0),
  ('total_themes_completed', 0)
ON CONFLICT (stat_name) DO NOTHING;

-- Enable RLS
ALTER TABLE global_stats ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Global stats are readable by everyone"
  ON global_stats FOR SELECT
  USING (true);
