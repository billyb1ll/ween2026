-- Migration: Memory Trap and Randomized Mission Queue
-- Adds mission_queue to user_vibe_status and updates swipe_card_secure_v2

-- 1. Alter Table
ALTER TABLE user_vibe_status ADD COLUMN IF NOT EXISTS mission_queue BIGINT[] DEFAULT '{}';

-- 2. Update RPC
CREATE OR REPLACE FUNCTION public.swipe_card_secure_v2(
    p_student_id character varying, 
    p_staff_id character varying, 
    p_direction character varying, 
    p_pin_hash character varying,
    p_is_memory_trap boolean DEFAULT false
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_role VARCHAR;
    v_user_exists BOOLEAN;
    v_target_role VARCHAR;
    v_target_major VARCHAR;
    v_target_house_position VARCHAR;
    v_target_name VARCHAR;
    v_mission_id BIGINT;
    v_mission_queue BIGINT[];
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
    v_is_match BOOLEAN;
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
    SELECT strike_count, lock_count, locked_until, current_mission_id, mission_queue
    INTO v_strike_count, v_lock_count, v_locked_until, v_mission_id, v_mission_queue
    FROM user_vibe_status
    WHERE student_id = p_student_id;

    -- Initialize user status if not present or mission_queue is entirely empty while v_mission_id is null
    IF NOT FOUND THEN
        -- Get all missions randomized
        SELECT array_agg(id ORDER BY random()) INTO v_mission_queue FROM vibe_missions;
        
        IF v_mission_queue IS NOT NULL AND array_length(v_mission_queue, 1) > 0 THEN
            v_mission_id := v_mission_queue[1];
            v_mission_queue := v_mission_queue[2:array_length(v_mission_queue, 1)];
        ELSE
            v_mission_id := NULL;
        END IF;

        INSERT INTO user_vibe_status (student_id, current_mission_id, strike_count, lock_count, locked_until, mission_queue)
        VALUES (p_student_id, v_mission_id, 0, 0, NULL, COALESCE(v_mission_queue, '{}'));
        
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
    SELECT role, major, nickname, house_position 
    INTO v_target_role, v_target_major, v_target_name, v_target_house_position
    FROM users
    WHERE student_id = p_staff_id;

    IF NOT FOUND THEN
        RETURN json_build_object('status', 'error', 'message', 'Target user not found');
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

    -- 4. Memory Retention Trap Logic
    IF p_is_memory_trap THEN
        IF p_direction = 'right' THEN
            -- TRAP TRIGGERED: 2 strikes
            v_strike_count := v_strike_count + 2;
            IF v_strike_count >= v_max_strikes THEN
                v_cooldown := v_base_cooldown * power(2, v_lock_count);
                IF v_cooldown > v_max_cooldown THEN v_cooldown := v_max_cooldown; END IF;
                v_new_lock_until := NOW() + (v_cooldown * INTERVAL '1 minute');

                UPDATE user_vibe_status 
                SET strike_count = 0,
                    lock_count = lock_count + 1,
                    locked_until = v_new_lock_until
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_lockout', p_student_id, 'User locked out for ' || v_cooldown::text || ' minutes due to strike limit (Memory Trap Triggered on ' || p_staff_id || ')');

                RETURN json_build_object(
                    'status', 'locked', 
                    'locked_until', v_new_lock_until, 
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status 
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_strike', p_student_id, 'Double Strike issued to user (Memory Trap Triggered on ' || p_staff_id || ') (Strike count: ' || v_strike_count::text || '/' || v_max_strikes::text || ')');

                RETURN json_build_object(
                    'status', 'strike',
                    'strike_count', v_strike_count,
                    'max_strikes', v_max_strikes
                );
            END IF;
        ELSE
            -- TRAP EVADED
            RETURN json_build_object('status', 'skipped', 'message', 'Trap safely evaded');
        END IF;
    END IF;

    -- Determine if target matches the mission requirement
    v_is_match := (v_target_major = v_req_role OR v_target_role = v_req_role OR v_target_house_position = v_req_role);

    -- 5. Evaluate Normal Swipe Logic
    IF p_direction = 'right' THEN
        IF v_is_match THEN
            -- CORRECT COLLECT
            INSERT INTO collected_cards (student_id, staff_id)
            VALUES (p_student_id, p_staff_id)
            ON CONFLICT DO NOTHING;

            SELECT COUNT(*)::INT INTO v_current_collected
            FROM collected_cards cc
            JOIN users u ON cc.staff_id = u.student_id
            WHERE cc.student_id = p_student_id 
              AND (u.major = v_req_role OR u.role = v_req_role OR u.house_position = v_req_role);

            IF v_current_collected >= v_req_count THEN
                IF array_length(v_mission_queue, 1) > 0 THEN
                    v_next_mission_id := v_mission_queue[1];
                    v_mission_queue := v_mission_queue[2:array_length(v_mission_queue, 1)];
                ELSE
                    v_next_mission_id := NULL;
                END IF;

                UPDATE user_vibe_status 
                SET current_mission_id = v_next_mission_id,
                    mission_queue = COALESCE(v_mission_queue, '{}'),
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

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_lockout', p_student_id, 'User locked out for ' || v_cooldown::text || ' minutes due to strike limit (incorrect collect on staff ID: ' || p_staff_id || ')');

                RETURN json_build_object(
                    'status', 'locked', 
                    'locked_until', v_new_lock_until, 
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status 
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_strike', p_student_id, 'Strike issued to user (incorrect collect on staff ID: ' || p_staff_id || ') (Strike count: ' || v_strike_count::text || '/' || v_max_strikes::text || ')');

                RETURN json_build_object(
                    'status', 'strike',
                    'strike_count', v_strike_count,
                    'max_strikes', v_max_strikes
                );
            END IF;
        END IF;
    ELSE
        -- LEFT SWIPE (Skip)
        IF v_is_match THEN
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

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_lockout', p_student_id, 'User locked out for ' || v_cooldown::text || ' minutes due to incorrect skip on staff ID: ' || p_staff_id);

                RETURN json_build_object(
                    'status', 'locked', 
                    'locked_until', v_new_lock_until, 
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status 
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_strike', p_student_id, 'Strike issued to user due to incorrect skip on staff ID: ' || p_staff_id || ' (Strike count: ' || v_strike_count::text || '/' || v_max_strikes::text || ')');

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
$function$
