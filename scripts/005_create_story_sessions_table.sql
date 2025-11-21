-- Create story_sessions table
CREATE TABLE IF NOT EXISTS story_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  current_scene INTEGER NOT NULL DEFAULT 0,
  pp_earned INTEGER DEFAULT 0,
  choices_made JSONB DEFAULT '[]',
  is_completed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_story_sessions_user_id ON story_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_story_sessions_theme_id ON story_sessions(theme_id);
CREATE INDEX IF NOT EXISTS idx_story_sessions_active ON story_sessions(user_id, is_completed) WHERE is_completed = false;

-- Enable RLS
ALTER TABLE story_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own sessions"
  ON story_sessions FOR ALL
  USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_story_sessions_updated_at
  BEFORE UPDATE ON story_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
