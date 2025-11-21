-- Enhanced security features
-- Rate limiting, anti-replay, and audit logging

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  action_type TEXT NOT NULL,
  action_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_action TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_user_rate_limit FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Anti-replay tracking for callbacks
CREATE TABLE IF NOT EXISTS processed_callbacks (
  callback_id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_processed_callbacks_expires ON processed_callbacks(expires_at);

-- Cleanup old records function
CREATE OR REPLACE FUNCTION cleanup_old_security_records()
RETURNS void AS $$
BEGIN
  DELETE FROM processed_callbacks WHERE expires_at < NOW();
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;
