-- Create themes table
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default themes
INSERT INTO themes (name, emoji, description) VALUES
  ('fantasy', '🏰', 'Avventure in mondi magici e fantastici'),
  ('sci-fi', '🚀', 'Esplorazione spaziale e tecnologia futuristica'),
  ('mystery', '🔍', 'Misteri da risolvere e indagini avvincenti'),
  ('horror', '👻', 'Storie spaventose e atmosfere inquietanti'),
  ('adventure', '🗺️', 'Avventure emozionanti in luoghi esotici'),
  ('romance', '💕', 'Storie d''amore e relazioni'),
  ('thriller', '🎭', 'Suspense e colpi di scena mozzafiato')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Themes are readable by everyone"
  ON themes FOR SELECT
  USING (true);
