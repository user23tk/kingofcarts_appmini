-- Fix critical bug: Create the missing check_comprehensive_rate_limit function
-- that supports hourly limits and should_count parameter

CREATE OR REPLACE FUNCTION check_comprehensive_rate_limit(
  user_id_param UUID,
  daily_limit INTEGER DEFAULT 20,
  hourly_limit INTEGER DEFAULT 10,
  should_count BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT,
  reset_time TIMESTAMP WITH TIME ZONE,
  daily_count INTEGER,
  hourly_count INTEGER
) AS $$
DECLARE
  current_daily_count INTEGER := 0;
  current_hourly_count INTEGER := 0;
  telegram_id_val BIGINT;
  next_hour TIMESTAMP WITH TIME ZONE;
  tomorrow_midnight TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get user's telegram_id for logging
  SELECT telegram_id INTO telegram_id_val
  FROM public.users
  WHERE id = user_id_param;

  -- Calculate reset times
  next_hour := date_trunc('hour', NOW()) + INTERVAL '1 hour';
  tomorrow_midnight := date_trunc('day', NOW()) + INTERVAL '1 day';

  -- Get or create today's rate limit record
  INSERT INTO public.rate_limits (user_id, date, request_count)
  VALUES (user_id_param, CURRENT_DATE, 0)
  ON CONFLICT (user_id, date) DO NOTHING;
  
  -- Get current daily count
  SELECT request_count INTO current_daily_count
  FROM public.rate_limits
  WHERE user_id = user_id_param AND date = CURRENT_DATE;
  
  -- Get current hourly count from security_events (using last hour)
  SELECT COUNT(*) INTO current_hourly_count
  FROM public.security_events
  WHERE user_id = user_id_param 
    AND event_type = 'rate_limit_request'
    AND created_at >= date_trunc('hour', NOW());
  
  -- Check daily limit first
  IF current_daily_count >= daily_limit THEN
    -- Log rate limit exceeded event if should_count is true
    IF should_count THEN
      PERFORM log_security_event(
        'rate_limit_exceeded',
        user_id_param,
        telegram_id_val,
        NULL,
        NULL,
        jsonb_build_object(
          'limit_type', 'daily',
          'daily_limit', daily_limit,
          'current_count', current_daily_count,
          'date', CURRENT_DATE
        )
      );
    END IF;
    
    RETURN QUERY SELECT FALSE, 'Daily limit exceeded', tomorrow_midnight, current_daily_count, current_hourly_count;
    RETURN;
  END IF;
  
  -- Check hourly limit
  IF current_hourly_count >= hourly_limit THEN
    -- Log rate limit exceeded event if should_count is true
    IF should_count THEN
      PERFORM log_security_event(
        'rate_limit_exceeded',
        user_id_param,
        telegram_id_val,
        NULL,
        NULL,
        jsonb_build_object(
          'limit_type', 'hourly',
          'hourly_limit', hourly_limit,
          'current_count', current_hourly_count,
          'hour', date_trunc('hour', NOW())
        )
      );
    END IF;
    
    RETURN QUERY SELECT FALSE, 'Hourly limit exceeded', next_hour, current_daily_count, current_hourly_count;
    RETURN;
  END IF;
  
  -- All checks passed - increment counters if should_count is true
  IF should_count THEN
    -- Increment daily counter
    UPDATE public.rate_limits 
    SET request_count = request_count + 1,
        updated_at = NOW()
    WHERE user_id = user_id_param AND date = CURRENT_DATE;
    
    -- Log request for hourly tracking
    PERFORM log_security_event(
      'rate_limit_request',
      user_id_param,
      telegram_id_val,
      NULL,
      NULL,
      jsonb_build_object(
        'daily_count', current_daily_count + 1,
        'hourly_count', current_hourly_count + 1
      )
    );
    
    current_daily_count := current_daily_count + 1;
    current_hourly_count := current_hourly_count + 1;
  END IF;
  
  -- Return success
  RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, current_daily_count, current_hourly_count;
END;
$$ LANGUAGE plpgsql;
