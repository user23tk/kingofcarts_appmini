-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_progress JSONB DEFAULT '{}',
  chapters_completed INTEGER DEFAULT 0,
  themes_completed INTEGER DEFAULT 0,
  total_pp INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_chapters ON user_progress(chapters_completed DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_themes ON user_progress(themes_completed DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_pp ON user_progress(total_pp DESC);

-- Enable RLS
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own progress"
  ON user_progress FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own progress"
  ON user_progress FOR UPDATE
  USING (true);

CREATE POLICY "Users can insert their own progress"
  ON user_progress FOR INSERT
  WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
