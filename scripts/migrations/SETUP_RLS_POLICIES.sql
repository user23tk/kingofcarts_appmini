-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can read own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can read own sessions" ON story_sessions;
DROP POLICY IF EXISTS "Users can manage own sessions" ON story_sessions;

-- USERS table policies
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (
    id = auth.uid()::text 
    OR id = (auth.jwt() -> 'user_metadata' ->> 'user_id')
  );

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (
    id = auth.uid()::text 
    OR id = (auth.jwt() -> 'user_metadata' ->> 'user_id')
  );

-- USER_PROGRESS table policies
CREATE POLICY "Users can read own progress"
  ON user_progress FOR SELECT
  USING (
    user_id = auth.uid()::text 
    OR user_id = (auth.jwt() -> 'user_metadata' ->> 'user_id')
  );

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (
    user_id = auth.uid()::text 
    OR user_id = (auth.jwt() -> 'user_metadata' ->> 'user_id')
  );

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text 
    OR user_id = (auth.jwt() -> 'user_metadata' ->> 'user_id')
  );

-- STORY_SESSIONS table policies
CREATE POLICY "Users can read own sessions"
  ON story_sessions FOR SELECT
  USING (
    user_id = auth.uid()::text 
    OR user_id = (auth.jwt() -> 'user_metadata' ->> 'user_id')
  );

CREATE POLICY "Users can manage own sessions"
  ON story_sessions FOR ALL
  USING (
    user_id = auth.uid()::text 
    OR user_id = (auth.jwt() -> 'user_metadata' ->> 'user_id')
  );

-- Public read access for themes and chapters (no sensitive data)
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read themes" ON themes;
DROP POLICY IF EXISTS "Anyone can read chapters" ON story_chapters;

CREATE POLICY "Anyone can read themes"
  ON themes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read chapters"
  ON story_chapters FOR SELECT
  USING (true);

-- Leaderboard and global stats are public
ALTER TABLE global_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read global stats" ON global_stats;

CREATE POLICY "Anyone can read global stats"
  ON global_stats FOR SELECT
  USING (true);

-- Service role can do everything (for admin operations)
-- This is handled automatically by Supabase

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
