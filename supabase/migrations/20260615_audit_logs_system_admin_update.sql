-- Migration: Audit Logs for Admin and System Actions
-- File: supabase/migrations/20260615_audit_logs_system_admin_update.sql

-- 1. Redefine delete_post_secure to log to audit_logs
CREATE OR REPLACE FUNCTION delete_post_secure(p_post_id bigint, p_student_id varchar, p_pin_hash varchar)
RETURNS boolean AS $$
DECLARE
    v_role varchar;
    v_post_author varchar;
BEGIN
    SELECT role INTO v_role FROM users WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid student ID or PIN';
    END IF;
    
    SELECT student_id INTO v_post_author FROM posts WHERE id = p_post_id;
    
    IF v_post_author = p_student_id OR v_role IN ('moderator', 'media_admin', 'staff') THEN
        DELETE FROM posts WHERE id = p_post_id;
        
        -- Insert into audit logs
        INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
        VALUES (
            CASE WHEN v_role IN ('moderator', 'media_admin', 'staff') THEN p_student_id ELSE NULL END,
            'post_delete',
            p_post_id::text,
            'Post deleted by ' || v_role || ' ' || p_student_id || ' (Author: ' || COALESCE(v_post_author, 'unknown') || ')'
        );
        
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to delete this post';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine delete_comment_secure to log to audit_logs
CREATE OR REPLACE FUNCTION delete_comment_secure(p_comment_id bigint, p_student_id varchar, p_pin_hash varchar)
RETURNS boolean AS $$
DECLARE
    v_role varchar;
    v_comment_author varchar;
BEGIN
    SELECT role INTO v_role FROM users WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid student ID or PIN';
    END IF;
    
    SELECT student_id INTO v_comment_author FROM post_comments WHERE id = p_comment_id;
    
    IF v_comment_author = p_student_id OR v_role IN ('moderator', 'media_admin', 'staff') THEN
        DELETE FROM post_comments WHERE id = p_comment_id;
        
        -- Insert into audit logs
        INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
        VALUES (
            CASE WHEN v_role IN ('moderator', 'media_admin', 'staff') THEN p_student_id ELSE NULL END,
            'comment_delete',
            p_comment_id::text,
            'Comment deleted by ' || v_role || ' ' || p_student_id || ' (Author: ' || COALESCE(v_comment_author, 'unknown') || ')'
        );
        
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to delete this comment';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redefine pin_post_secure to log to audit_logs
CREATE OR REPLACE FUNCTION pin_post_secure(p_post_id bigint, p_student_id character varying, p_pin_hash character varying, p_is_pinned boolean)
RETURNS boolean AS $$
DECLARE
    v_role varchar;
BEGIN
    SELECT role INTO v_role FROM users WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid student ID or PIN';
    END IF;
    
    IF v_role IN ('moderator', 'media_admin', 'staff') THEN
        UPDATE posts SET is_pinned = p_is_pinned WHERE id = p_post_id;
        
        -- Insert into audit logs
        INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
        VALUES (
            p_student_id,
            'post_pin',
            p_post_id::text,
            'Post pin status set to ' || p_is_pinned::text || ' by ' || v_role || ' ' || p_student_id
        );
        
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to pin this post';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Redefine swipe_card_secure to log strikes & lockouts (system actions) to audit_logs
CREATE OR REPLACE FUNCTION swipe_card_secure(
    p_student_id VARCHAR,
    p_staff_id VARCHAR,
    p_direction VARCHAR, -- 'right' (Collect) or 'left' (Skip)
    p_pin_hash VARCHAR
)
RETURNS JSON AS $$
DECLARE
    v_user_role VARCHAR;
    v_user_exists BOOLEAN;
    v_target_role VARCHAR;
    v_target_major VARCHAR;
    v_target_name VARCHAR;
    v_mission_id BIGINT;
    v_req_role VARCHAR;
    v_req_count INT;
    v_current_collected INT;
    v_strike_count INT;
    v_lock_count INT;
    v_locked_until TIMESTAMPTZ;
    v_max_strikes INT;
    v_base_cooldown INT;
    v_max_cooldown INT;
    v_cooldown INT;
    v_new_lock_until TIMESTAMPTZ;
    v_next_mission_id BIGINT;
BEGIN
    -- 1. Authentication Check
    SELECT role, EXISTS(SELECT 1 FROM users WHERE student_id = p_student_id) 
    INTO v_user_role, v_user_exists
    FROM users 
    WHERE student_id = p_student_id AND pin_hash = p_pin_hash;

    IF v_user_exists IS NOT TRUE THEN
        RETURN json_build_object('status', 'error', 'message', 'Unauthorized: Invalid credentials or un-registered account');
    END IF;

    -- 2. Lockout Check
    SELECT strike_count, lock_count, locked_until, current_mission_id
    INTO v_strike_count, v_lock_count, v_locked_until, v_mission_id
    FROM user_vibe_status
    WHERE student_id = p_student_id;

    -- Initialize user status if not present
    IF NOT FOUND THEN
        -- Get the first mission
        SELECT id INTO v_mission_id FROM vibe_missions ORDER BY sequence_order ASC LIMIT 1;
        
        INSERT INTO user_vibe_status (student_id, current_mission_id, strike_count, lock_count, locked_until)
        VALUES (p_student_id, v_mission_id, 0, 0, NULL);
        
        v_strike_count := 0;
        v_lock_count := 0;
        v_locked_until := NULL;
    END IF;

    IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
        RETURN json_build_object(
            'status', 'locked', 
            'locked_until', v_locked_until, 
            'seconds_remaining', EXTRACT(EPOCH FROM (v_locked_until - NOW()))
        );
    END IF;

    -- 3. Resolve Target Details
    SELECT role, major, nickname INTO v_target_role, v_target_major, v_target_name
    FROM users
    WHERE student_id = p_staff_id;

    IF NOT FOUND THEN
        RETURN json_build_object('status', 'error', 'message', 'Target user not found');
    END IF;

    -- Ensure we have an active mission
    IF v_mission_id IS NULL THEN
        -- Default to first mission
        SELECT id INTO v_mission_id FROM vibe_missions ORDER BY sequence_order ASC LIMIT 1;
        UPDATE user_vibe_status SET current_mission_id = v_mission_id WHERE student_id = p_student_id;
    END IF;

    -- Retrieve active mission spec
    SELECT target_role, required_count
    INTO v_req_role, v_req_count
    FROM vibe_missions
    WHERE id = v_mission_id;

    IF NOT FOUND THEN
        -- No active mission spec
        RETURN json_build_object('status', 'all_complete', 'message', 'All missions already completed!');
    END IF;

    -- Get penalty configurations from system_config
    SELECT int_value INTO v_max_strikes FROM system_config WHERE key = 'max_allowed_strikes';
    IF v_max_strikes IS NULL THEN v_max_strikes := 5; END IF;

    SELECT int_value INTO v_base_cooldown FROM system_config WHERE key = 'base_cooldown_minutes';
    IF v_base_cooldown IS NULL THEN v_base_cooldown := 1; END IF;

    SELECT int_value INTO v_max_cooldown FROM system_config WHERE key = 'max_cooldown_minutes';
    IF v_max_cooldown IS NULL THEN v_max_cooldown := 30; END IF;

    -- 4. Evaluate Swipe Logic
    IF p_direction = 'right' THEN
        IF v_target_major = v_req_role OR v_target_role = v_req_role THEN
            -- CORRECT COLLECT
            INSERT INTO collected_cards (student_id, staff_id)
            VALUES (p_student_id, p_staff_id)
            ON CONFLICT DO NOTHING;

            SELECT COUNT(*)::INT INTO v_current_collected
            FROM collected_cards cc
            JOIN users u ON cc.staff_id = u.student_id
            WHERE cc.student_id = p_student_id 
              AND (u.major = v_req_role OR u.role = v_req_role);

            IF v_current_collected >= v_req_count THEN
                SELECT id INTO v_next_mission_id 
                FROM vibe_missions 
                WHERE sequence_order > (SELECT sequence_order FROM vibe_missions WHERE id = v_mission_id)
                ORDER BY sequence_order ASC 
                LIMIT 1;

                UPDATE user_vibe_status 
                SET current_mission_id = v_next_mission_id,
                    strike_count = 0,
                    lock_count = 0,
                    locked_until = NULL
                WHERE student_id = p_student_id;

                RETURN json_build_object(
                    'status', 'mission_cleared',
                    'collected_staff_name', v_target_name,
                    'current_count', v_current_collected,
                    'required_count', v_req_count,
                    'next_mission_id', v_next_mission_id
                );
            ELSE
                RETURN json_build_object(
                    'status', 'collected',
                    'collected_staff_name', v_target_name,
                    'current_count', v_current_collected,
                    'required_count', v_req_count
                );
            END IF;
        ELSE
            -- INCORRECT COLLECT (Strike!)
            v_strike_count := v_strike_count + 1;
            IF v_strike_count >= v_max_strikes THEN
                v_cooldown := v_base_cooldown * power(2, v_lock_count);
                IF v_cooldown > v_max_cooldown THEN v_cooldown := v_max_cooldown; END IF;
                v_new_lock_until := NOW() + (v_cooldown * INTERVAL '1 minute');

                UPDATE user_vibe_status 
                SET strike_count = 0,
                    lock_count = lock_count + 1,
                    locked_until = v_new_lock_until
                WHERE student_id = p_student_id;

                -- Log system lockout
                INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
                VALUES (NULL, 'system_lockout', p_student_id, 'User locked out for ' || v_cooldown::text || ' minutes due to strike limit (incorrect collect on staff ID: ' || p_staff_id || ')');

                RETURN json_build_object(
                    'status', 'locked', 
                    'locked_until', v_new_lock_until, 
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status 
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                -- Log system strike
                INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
                VALUES (NULL, 'system_strike', p_student_id, 'Strike issued to user (incorrect collect on staff ID: ' || p_staff_id || ') (Strike count: ' || v_strike_count::text || '/' || v_max_strikes::text || ')');

                RETURN json_build_object(
                    'status', 'strike',
                    'strike_count', v_strike_count,
                    'max_strikes', v_max_strikes
                );
            END IF;
        END IF;
    ELSE
        -- LEFT SWIPE (Skip)
        IF v_target_major = v_req_role OR v_target_role = v_req_role THEN
            -- MISSED OPPORTUNITY (Strike!)
            v_strike_count := v_strike_count + 1;
            IF v_strike_count >= v_max_strikes THEN
                v_cooldown := v_base_cooldown * power(2, v_lock_count);
                IF v_cooldown > v_max_cooldown THEN v_cooldown := v_max_cooldown; END IF;
                v_new_lock_until := NOW() + (v_cooldown * INTERVAL '1 minute');

                UPDATE user_vibe_status 
                SET strike_count = 0,
                    lock_count = lock_count + 1,
                    locked_until = v_new_lock_until
                WHERE student_id = p_student_id;

                -- Log system lockout
                INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
                VALUES (NULL, 'system_lockout', p_student_id, 'User locked out for ' || v_cooldown::text || ' minutes due to incorrect skip on staff ID: ' || p_staff_id);

                RETURN json_build_object(
                    'status', 'locked', 
                    'locked_until', v_new_lock_until, 
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status 
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                -- Log system strike
                INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
                VALUES (NULL, 'system_strike', p_student_id, 'Strike issued to user due to incorrect skip on staff ID: ' || p_staff_id || ' (Strike count: ' || v_strike_count::text || '/' || v_max_strikes::text || ')');

                RETURN json_build_object(
                    'status', 'strike',
                    'strike_count', v_strike_count,
                    'max_strikes', v_max_strikes
                );
            END IF;
        ELSE
            RETURN json_build_object(
                'status', 'skipped'
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
