-- Migration: Secure Emergency Broadcast configuration RPC function
-- Validates user session token, checks for moderator or media_admin role,
-- upserts config, and logs action to audit logs.

CREATE OR REPLACE FUNCTION broadcast_emergency_message(
    p_session_token UUID,
    p_active BOOLEAN,
    p_text TEXT
)
RETURNS JSON AS $$
DECLARE
    v_student_id VARCHAR;
    v_role VARCHAR;
BEGIN
    -- Validate session token and check expiration
    SELECT s.student_id, u.role INTO v_student_id, v_role
    FROM user_sessions s
    JOIN users u ON s.student_id = u.student_id
    WHERE s.session_token = p_session_token AND s.expires_at > NOW();

    -- If no valid session is found, throw an exception
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid or expired session token';
    END IF;

    -- Verify that the user has administrative privileges
    IF v_role IS NULL OR (v_role != 'moderator' AND v_role != 'media_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient administrative privileges';
    END IF;

    -- Upsert the emergency configuration in system_config
    INSERT INTO system_config (key, value, text_value)
    VALUES ('emergency_announcement', p_active, p_text)
    ON CONFLICT (key) DO UPDATE
    SET value = p_active, text_value = p_text;

    -- Log the administrative action in audit logs
    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (v_student_id, 'emergency_broadcast', 'system_config', 'Broadcast updated: active=' || p_active::text || ', text="' || p_text || '"');

    RETURN json_build_object('status', 'success', 'message', 'Broadcast saved successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
