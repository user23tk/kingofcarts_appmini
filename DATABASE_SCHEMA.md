# Database Schema Documentation

## Schema Overview

### Real Database Tables (from Supabase)

**Important**: The production database schema differs from some script definitions. This section documents the ACTUAL tables in production.

The following tables exist in the production database:

## Core Tables

### 1. users
Primary user table storing Telegram user information.

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT DEFAULT 'en',
  is_bot BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

**Indexes:**
- `idx_users_telegram_id` on `telegram_id`

**RLS:** Enabled - Users can read their own data

---

### 2. themes
Story themes/categories.

\`\`\`sql
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  is_active BOOLEAN DEFAULT true,
  is_event BOOLEAN DEFAULT false,
  event_emoji TEXT,
  event_start_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  pp_multiplier NUMERIC(3,2) DEFAULT 1.0,
  total_chapters INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

**Indexes:**
- `idx_themes_active` on `is_active`
- `idx_themes_event_active` on `(is_event, is_active)` WHERE `is_event = true`
- `idx_themes_event_expiration` on `event_end_date` WHERE `is_event = true AND is_active = true`

**RLS:** Enabled - Readable by everyone

---

### 3. story_chapters
Individual story chapters for each theme.

\`\`\`sql
CREATE TABLE story_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  pp_reward INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(theme_id, chapter_number)
);
\`\`\`

**Indexes:**
- `idx_story_chapters_theme` on `theme_id`
- `idx_story_chapters_theme_number` on `(theme_id, chapter_number)`

**RLS:** Enabled - Readable by everyone

---

### 4. user_progress
Tracks user progress across all themes.

\`\`\`sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  current_theme TEXT,
  current_chapter INTEGER DEFAULT 1,
  chapters_completed INTEGER DEFAULT 0,
  themes_completed INTEGER DEFAULT 0,
  completed_themes TEXT[] DEFAULT ARRAY[]::TEXT[],
  total_pp INTEGER DEFAULT 0,
  theme_progress JSONB DEFAULT '{}'::jsonb,
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
\`\`\`

**Important Notes:**
- `chapters_completed` is the canonical column for total chapters completed
- `total_chapters_completed` is DEPRECATED (kept for backward compatibility)
- `theme_progress` JSONB is automatically synced via trigger

**Indexes:**
- `idx_user_progress_user_id` on `user_id`
- `idx_user_progress_leaderboard` on `(chapters_completed DESC, themes_completed DESC, total_pp DESC)`
- `idx_user_progress_theme_progress_gin` GIN index on `theme_progress`

**RLS:** Enabled - Users can manage their own progress

**Triggers:**
- `sync_theme_progress_trigger` - Automatically syncs `theme_progress` JSONB with aggregate columns

---

### 5. story_sessions
Active and completed story sessions.

⚠️ **WARNING**: This table is defined in scripts but does NOT exist in the production database.

\`\`\`sql
CREATE TABLE story_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  current_scene INTEGER DEFAULT 0,
  pp_earned INTEGER DEFAULT 0,
  choices_made JSONB DEFAULT '[]',
  is_completed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

**Indexes:**
- `idx_story_sessions_user_id` on `user_id`
- `idx_story_sessions_theme_id` on `theme_id`
- `idx_story_sessions_user_active` on `(user_id, is_completed)` WHERE `is_completed = false`

**RLS:** Enabled - Users can manage their own sessions

---

### 6. event_leaderboard
Leaderboard for event-based competitions.

\`\`\`sql
CREATE TABLE event_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- TEXT, not UUID!
  theme TEXT NOT NULL,    -- TEXT, not UUID reference
  total_pp INTEGER DEFAULT 0,
  chapters_completed INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, theme)
);
\`\`\`

**Important Notes:**
- `user_id` is TEXT (stores telegram_id as string, not UUID)
- `theme` is TEXT (references themes.name, not themes.id)
- Cannot have FK constraints due to type mismatch

---

### 7. pp_audit
Audit log for PP (Progress Points) transactions.

\`\`\`sql
CREATE TABLE pp_audit (
  id BIGINT PRIMARY KEY DEFAULT nextval('pp_audit_id_seq'),
  user_id TEXT NOT NULL,  -- TEXT, not UUID!
  theme TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  scene_index INTEGER NOT NULL,
  choice_id TEXT NOT NULL,
  pp_gained INTEGER NOT NULL,
  session_total_pp INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET
);
\`\`\`

**Important Notes:**
- `user_id` is TEXT (stores telegram_id as string, not UUID)
- Cannot have FK constraint to users.id due to type mismatch
- Uses BIGINT serial ID instead of UUID

---

## Key RPC Functions

### User Progress Functions
- `get_user_rank(user_id)` - Get user's global rank
- `get_top_players(limit)` - Get top N players
- `get_dashboard_stats(user_id)` - Get complete dashboard statistics
- `get_theme_progress(user_id)` - Get progress for all themes
- `update_chapter_completion(...)` - Update progress after chapter completion

### Event Functions
- `get_active_event()` - Get currently active event
- `deactivate_expired_events()` - Deactivate expired events
- `update_event_leaderboard_atomic(...)` - Update event leaderboard atomically
- `complete_chapter_atomic(...)` - Complete chapter with atomic transaction
- `get_event_leaderboard(theme, limit)` - Get event leaderboard
- `get_user_event_rank(user_id, theme)` - Get user's rank in event

---

## Data Consistency Rules

1. **Chapter Counts**: `chapters_completed` is the source of truth
2. **Theme Progress**: Automatically synced via trigger when `theme_progress` JSONB is updated
3. **Cascade Deletes**: Only applies to tables with proper UUID FK constraints
4. **Event Leaderboard**: Uses TEXT fields for flexibility with Telegram IDs (no FK constraints)
5. **PP Audit**: Uses TEXT user_id (no FK constraint to users table)

---

## Migration Notes

### Schema Alignment Issues

**Type Mismatches:**
- `event_leaderboard.user_id` and `pp_audit.user_id` are TEXT
- These cannot have FK constraints to `users.id` (UUID)
- This is by design for Telegram bot architecture

**Missing Tables:**
- `story_sessions` defined in scripts but not in production
- Review code for references to this table

### Deprecated Columns
- `user_progress.total_chapters_completed` - Use `chapters_completed` instead

---

## Security

### Row Level Security (RLS)
All tables have RLS enabled with appropriate policies:
- Users can only access their own data
- Public data (themes, chapters) is readable by everyone
- Leaderboards are readable by everyone
- Audit logs preserve data even after user deletion

### Foreign Key Constraints

**With CASCADE DELETE:**
- `user_progress.user_id` → `users.id` (CASCADE)
- `user_sessions.user_id` → `users.id` (CASCADE)
- `story_chapters.theme_id` → `themes.id` (CASCADE)
- `rate_limits.user_id` → `users.id` (CASCADE)
- `security_events.user_id` → `users.id` (CASCADE)
- `audit_logs.user_id` → `users.id` (CASCADE)

**Without FK (TEXT type mismatch):**
- `event_leaderboard.user_id` - Stores telegram_id as TEXT (no FK possible)
- `pp_audit.user_id` - Stores telegram_id as TEXT (no FK possible)

These tables use TEXT for `user_id` to store Telegram IDs directly, which prevents FK constraints but is intentional for the bot architecture.

---

## Performance Optimization

### Composite Indexes
- Leaderboard queries optimized with multi-column indexes
- JSONB queries optimized with GIN indexes
- Active session lookups optimized with partial indexes

### Query Patterns
- Use RPC functions for complex queries
- Leverage indexes for sorting and filtering
- Use JSONB operators for theme_progress queries

---

Last Updated: 2025-01-02
