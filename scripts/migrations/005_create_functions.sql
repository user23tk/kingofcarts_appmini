-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON public.user_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_stats_updated_at BEFORE UPDATE ON public.global_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON public.rate_limits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment global stats
CREATE OR REPLACE FUNCTION increment_global_stat(stat_name_param TEXT, increment_by INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.global_stats (stat_name, stat_value)
    VALUES (stat_name_param, increment_by)
    ON CONFLICT (stat_name) 
    DO UPDATE SET 
        stat_value = public.global_stats.stat_value + increment_by,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(user_id_param UUID, daily_limit INTEGER DEFAULT 20)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
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
    IF current_count < daily_limit THEN
        -- Increment counter
        UPDATE public.rate_limits 
        SET request_count = request_count + 1
        WHERE user_id = user_id_param AND date = CURRENT_DATE;
        
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;
