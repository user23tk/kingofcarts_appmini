-- Final cleanup of obsolete rate limiting functions
-- Remove old rate limiting functions that are no longer used

-- Drop the old simple rate limit function (replaced by check_rate_limit)
DROP FUNCTION IF EXISTS check_rate_limit_simple(UUID, INTEGER);

-- Drop the enhanced rate limit function (replaced by check_rate_limit) 
DROP FUNCTION IF EXISTS check_rate_limit_enhanced(UUID, INTEGER, INTEGER, INTEGER, INTEGER);

-- Drop the comprehensive rate limit function (replaced by simpler check_rate_limit)
DROP FUNCTION IF EXISTS check_comprehensive_rate_limit(UUID, INTEGER, INTEGER, INTEGER, INTEGER, BOOLEAN);

-- Ensure only the current check_rate_limit function exists
-- This function should already exist from previous scripts
-- If it doesn't exist, create it
CREATE OR REPLACE FUNCTION check_rate_limit(user_id UUID, daily_limit INTEGER DEFAULT 20)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    daily_count INTEGER;
    today_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate start of today in UTC
    today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC');
    
    -- Count interactions today
    SELECT COUNT(*)
    INTO daily_count
    FROM user_interactions
    WHERE user_interactions.user_id = check_rate_limit.user_id
    AND created_at >= today_start;
    
    -- Return true if under limit, false if over limit
    RETURN daily_count < daily_limit;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION check_rate_limit(UUID, INTEGER) IS 'Simple daily rate limiting function - returns true if user is under daily limit';
