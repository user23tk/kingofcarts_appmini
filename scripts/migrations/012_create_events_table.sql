-- Events table for special themed events
-- Supports limited-time events with custom rewards

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  event_emoji TEXT DEFAULT '🎉',
  theme TEXT NOT NULL,
  pp_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_multiplier CHECK (pp_multiplier >= 1.00 AND pp_multiplier <= 10.00),
  CONSTRAINT check_dates CHECK (end_date > start_date)
);

-- Index for active events
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_event_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_timestamp
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION update_event_updated_at();
