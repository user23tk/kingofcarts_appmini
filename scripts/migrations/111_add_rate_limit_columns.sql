-- =============================================
-- SCRIPT 111: Add hourly and burst rate limiting columns
-- =============================================

-- Step 1: Add missing columns for hourly and burst rate limiting
ALTER TABLE rate_limits 
ADD COLUMN IF NOT EXISTS hourly_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS burst_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_hourly_reset timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_burst_reset timestamptz DEFAULT now();

-- Step 2: Rename request_count to daily_count for clarity (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rate_limits' AND column_name = 'request_count') THEN
        ALTER TABLE rate_limits RENAME COLUMN request_count TO daily_count;
    END IF;
END $$;

-- Step 3: Ensure daily_count column exists
ALTER TABLE rate_limits 
ADD COLUMN IF NOT EXISTS daily_count integer DEFAULT 0;

-- Step 4: Add last_daily_reset if not exists
ALTER TABLE rate_limits 
ADD COLUMN IF NOT EXISTS last_daily_reset timestamptz DEFAULT now();

-- Step 5: Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);

-- Step 6: Update RLS policy to allow service role full access
DROP POLICY IF EXISTS "Service role can manage rate limits" ON rate_limits;
CREATE POLICY "Service role can manage rate limits" ON rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verification
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'rate_limits'
ORDER BY ordinal_position;
