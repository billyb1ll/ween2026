-- =============================================================================
-- Migration: P1 System Config Upsert Fix
-- Date: 2026-07-08
-- Fixes: Allows admin_update_system_config to insert new keys (upsert behavior)
--        to match previous frontend functionality before RLS tightening.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_system_config(
    p_admin_id   VARCHAR,
    p_admin_pin  VARCHAR,
    p_key        VARCHAR,
    p_value      BOOLEAN  DEFAULT NULL,
    p_int_value  INTEGER  DEFAULT NULL,
    p_text_value TEXT     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role VARCHAR;
BEGIN
    SELECT role INTO v_admin_role
    FROM users
    WHERE student_id = p_admin_id AND pin_hash = p_admin_pin;

    IF v_admin_role IS NULL OR v_admin_role NOT IN ('moderator', 'media_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient role or invalid credentials';
    END IF;

    INSERT INTO system_config (key, value, int_value, text_value)
    VALUES (p_key, p_value, p_int_value, p_text_value)
    ON CONFLICT (key) DO UPDATE
    SET value      = COALESCE(EXCLUDED.value,      system_config.value),
        int_value  = COALESCE(EXCLUDED.int_value,  system_config.int_value),
        text_value = COALESCE(EXCLUDED.text_value, system_config.text_value);

    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'config_update', p_key,
        'System config "' || p_key || '" updated by ' || v_admin_role || ' ' || p_admin_id);
END;
$$;
