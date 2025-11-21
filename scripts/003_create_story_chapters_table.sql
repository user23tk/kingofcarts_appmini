-- Create story_chapters table
CREATE TABLE IF NOT EXISTS story_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(theme_id, chapter_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_story_chapters_theme_id ON story_chapters(theme_id);
CREATE INDEX IF NOT EXISTS idx_story_chapters_chapter_number ON story_chapters(chapter_number);
CREATE INDEX IF NOT EXISTS idx_story_chapters_active ON story_chapters(is_active);

-- Enable RLS
ALTER TABLE story_chapters ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Story chapters are readable by everyone"
  ON story_chapters FOR SELECT
  USING (is_active = true);

-- Create updated_at trigger
CREATE TRIGGER update_story_chapters_updated_at
  BEFORE UPDATE ON story_chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
