-- Story sessions table to track active story sessions
-- Tracks user's current position in a story and PP accumulated

CREATE TABLE IF NOT EXISTS story_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  theme TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  current_scene INTEGER NOT NULL DEFAULT 0,
  pp_accumulated INTEGER NOT NULL DEFAULT 0,
  session_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_story_sessions_user_id ON story_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_story_sessions_expires_at ON story_sessions(expires_at);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_story_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_story_session_timestamp
BEFORE UPDATE ON story_sessions
FOR EACH ROW
EXECUTE FUNCTION update_story_session_updated_at();
