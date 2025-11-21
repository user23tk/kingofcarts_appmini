-- Enhanced rate limiting and security features

-- Add IP tracking for security monitoring
ALTER TABLE public.rate_limits ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE public.rate_limits ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create security events table for monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'rate_limit_exceeded', 'suspicious_activity', 'replay_attempt'
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_id BIGINT,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on security events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security events
CREATE POLICY "security_events_select_all" ON public.security_events 
  FOR SELECT USING (TRUE);

CREATE POLICY "security_events_insert_all" ON public.security_events 
  FOR INSERT WITH CHECK (TRUE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_telegram ON public.security_events(telegram_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at);

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  event_type_param TEXT,
  user_id_param UUID DEFAULT NULL,
  telegram_id_param BIGINT DEFAULT NULL,
  ip_address_param INET DEFAULT NULL,
  user_agent_param TEXT DEFAULT NULL,
  details_param JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.security_events (
    event_type,
    user_id,
    telegram_id,
    ip_address,
    user_agent,
    details
  ) VALUES (
    event_type_param,
    user_id_param,
    telegram_id_param,
    ip_address_param,
    user_agent_param,
    details_param
  );
END;
$$ LANGUAGE plpgsql;

-- Enhanced rate limit function with security logging
CREATE OR REPLACE FUNCTION check_rate_limit_enhanced(
  user_id_param UUID,
  daily_limit INTEGER DEFAULT 20,
  ip_address_param INET DEFAULT NULL,
  user_agent_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  telegram_id_val BIGINT;
BEGIN
  -- Get user's telegram_id for logging
  SELECT telegram_id INTO telegram_id_val
  FROM public.users
  WHERE id = user_id_param;

  -- Get or create today's rate limit record
  INSERT INTO public.rate_limits (user_id, date, request_count, ip_address, user_agent)
  VALUES (user_id_param, CURRENT_DATE, 0, ip_address_param, user_agent_param)
  ON CONFLICT (user_id, date) DO UPDATE SET
    ip_address = COALESCE(EXCLUDED.ip_address, public.rate_limits.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, public.rate_limits.user_agent);
  
  -- Get current count
  SELECT request_count INTO current_count
  FROM public.rate_limits
  WHERE user_id = user_id_param AND date = CURRENT_DATE;
  
  -- Check if under limit
  IF current_count < daily_limit THEN
    -- Increment counter
    UPDATE public.rate_limits 
    SET request_count = request_count + 1,
        updated_at = NOW()
    WHERE user_id = user_id_param AND date = CURRENT_DATE;
    
    RETURN TRUE;
  ELSE
    -- Log rate limit exceeded event
    PERFORM log_security_event(
      'rate_limit_exceeded',
      user_id_param,
      telegram_id_val,
      ip_address_param,
      user_agent_param,
      jsonb_build_object(
        'daily_limit', daily_limit,
        'current_count', current_count,
        'date', CURRENT_DATE
      )
    );
    
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old security events (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_security_events()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.security_events
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
