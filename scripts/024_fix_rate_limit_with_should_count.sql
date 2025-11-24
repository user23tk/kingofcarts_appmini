-- Fix rate limiting to respect should_count parameter
-- This ensures that checking limits doesn't automatically consume the user's quota

-- Drop the old simple function that always increments
DROP FUNCTION IF EXISTS check_rate_limit(UUID, INTEGER);

-- Create new function that respects should_count parameter
CREATE OR REPLACE FUNCTION check_rate_limit(
  user_id_param UUID,
  daily_limit INTEGER DEFAULT 20,
  should_count BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INTEGER := 0;
BEGIN
  -- Get or create today's rate limit record
  INSERT INTO public.rate_limits (user_id, date, request_count)
  VALUES (user_id_param, CURRENT_DATE, 0)
  ON CONFLICT (user_id, date) DO NOTHING;
  
  -- Get current count
  SELECT request_count INTO current_count
  FROM public.rate_limits
  WHERE user_id = user_id_param AND date = CURRENT_DATE;
  
  -- Check if under limit
  IF current_count >= daily_limit THEN
    -- Already over limit, don't increment
    RETURN FALSE;
  END IF;
  
  -- Under limit - increment ONLY if should_count is true
  IF should_count THEN
    UPDATE public.rate_limits 
    SET request_count = request_count + 1,
        updated_at = NOW()
    WHERE user_id = user_id_param AND date = CURRENT_DATE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION check_rate_limit(UUID, INTEGER, BOOLEAN) IS 
'Rate limiting function with should_count support. Only increments counter when should_count=true, allowing non-counting checks.';
