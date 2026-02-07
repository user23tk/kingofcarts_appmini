-- Migration: Add deactivate_expired_giveaways RPC
-- Date: 2026-02-07

CREATE OR REPLACE FUNCTION deactivate_expired_giveaways()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH deactivated AS (
        UPDATE giveaways
        SET is_active = false
        WHERE is_active = true
          AND ends_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deactivated;

    -- Log if any giveaways were deactivated
    IF v_count > 0 THEN
        INSERT INTO audit_logs (level, context, message, metadata)
        VALUES ('info', 'cron-giveaways', 'Deactivated expired giveaways', jsonb_build_object('count', v_count));
    END IF;

    RETURN v_count;
END;
$$;
