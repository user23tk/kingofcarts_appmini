-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
  multiplier NUMERIC(3,2) DEFAULT 1.0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_theme_id ON events(theme_id);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Events are readable by everyone"
  ON events FOR SELECT
  USING (true);
