-- Remove unused complex rate limiting functions to simplify system
DROP FUNCTION IF EXISTS check_comprehensive_rate_limit(uuid, integer, integer, boolean);
DROP FUNCTION IF EXISTS check_rate_limit_enhanced(uuid, integer);

-- Keep only the simple check_rate_limit function that we actually use
-- This function already exists and works correctly
