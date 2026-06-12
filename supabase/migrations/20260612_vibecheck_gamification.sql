-- Migration: Vibe Check Gamification and Moderator Transition
-- Upgrades user roles, registers game tables, configures penalty settings, and sets up the swipe validation engine.

-- 1. Moderator Role Transition (Drop constraint first to prevent immediate check violation)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'moderator' WHERE role = 'superadmin';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('moderator', 'media_admin', 'staff', 'student'));

-- 2. Create Gamification Tables
CREATE TABLE IF NOT EXISTS vibe_missions (
    id BIGSERIAL PRIMARY KEY,
    sequence_order INTEGER UNIQUE NOT NULL,
    target_role VARCHAR NOT NULL,
    required_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_vibe_status (
    student_id VARCHAR PRIMARY KEY REFERENCES users(student_id) ON DELETE CASCADE,
    current_mission_id BIGINT REFERENCES vibe_missions(id) ON DELETE SET NULL,
    strike_count INTEGER DEFAULT 0,
    lock_count INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS collected_cards (
    id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR REFERENCES users(student_id) ON DELETE CASCADE,
    staff_id VARCHAR REFERENCES users(student_id) ON DELETE CASCADE,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_student_staff UNIQUE (student_id, staff_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    moderator_id VARCHAR REFERENCES users(student_id) ON DELETE SET NULL,
    action_type VARCHAR NOT NULL,
    target_id VARCHAR,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Row Level Security & Access Policies
ALTER TABLE vibe_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vibe_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE collected_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all select vibe_missions" ON vibe_missions;
DROP POLICY IF EXISTS "Allow all vibe_missions" ON vibe_missions;
CREATE POLICY "Allow all select vibe_missions" ON vibe_missions FOR SELECT USING (true);
CREATE POLICY "Allow all vibe_missions" ON vibe_missions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all select user_vibe_status" ON user_vibe_status;
DROP POLICY IF EXISTS "Allow all user_vibe_status" ON user_vibe_status;
CREATE POLICY "Allow all select user_vibe_status" ON user_vibe_status FOR SELECT USING (true);
CREATE POLICY "Allow all user_vibe_status" ON user_vibe_status FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all select collected_cards" ON collected_cards;
DROP POLICY IF EXISTS "Allow all collected_cards" ON collected_cards;
CREATE POLICY "Allow all select collected_cards" ON collected_cards FOR SELECT USING (true);
CREATE POLICY "Allow all collected_cards" ON collected_cards FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all select audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Allow insert audit_logs" ON audit_logs;
CREATE POLICY "Allow all select audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert audit_logs" ON audit_logs FOR INSERT WITH CHECK (true);

-- 4. Extend system_config Table for Mixed Types
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS text_value TEXT;
ALTER TABLE system_config ADD COLUMN IF NOT EXISTS int_value INTEGER;

-- 5. Seed Configurations and Initial Missions
INSERT INTO system_config (key, value, text_value, int_value) VALUES
('emergency_announcement', false, '', 0),
('max_allowed_strikes', true, NULL, 5),
('base_cooldown_minutes', true, NULL, 1),
('max_cooldown_minutes', true, NULL, 30)
ON CONFLICT (key) DO UPDATE SET
  int_value = EXCLUDED.int_value,
  text_value = EXCLUDED.text_value;

INSERT INTO vibe_missions (sequence_order, target_role, required_count) VALUES
(1, 'โสต', 2),
(2, 'สันทนาการ', 3),
(3, 'พี่กลุ่ม', 4)
ON CONFLICT (sequence_order) DO UPDATE SET
  target_role = EXCLUDED.target_role,
  required_count = EXCLUDED.required_count;

-- 6. Secure Server-Side Vibe Check Swipe Validation RPC Function
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

    -- 3. Resolve Target Details (Omitted to client to prevent spoilers)
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
        -- No active mission spec (e.g. all missions complete)
        RETURN json_build_object('status', 'all_complete', 'message', 'All missions already completed!');
    END IF;

    -- Get penalty configurations from system_config (default fallbacks if missing)
    -- Max allowed strikes
    SELECT int_value INTO v_max_strikes FROM system_config WHERE key = 'max_allowed_strikes';
    IF v_max_strikes IS NULL THEN v_max_strikes := 5; END IF;

    -- Base cooldown in minutes
    SELECT int_value INTO v_base_cooldown FROM system_config WHERE key = 'base_cooldown_minutes';
    IF v_base_cooldown IS NULL THEN v_base_cooldown := 1; END IF;

    -- Max cooldown in minutes
    SELECT int_value INTO v_max_cooldown FROM system_config WHERE key = 'max_cooldown_minutes';
    IF v_max_cooldown IS NULL THEN v_max_cooldown := 30; END IF;

    -- 4. Evaluate Swipe Logic
    -- Target is correct if its major (staff position) equals target_role OR its role equals target_role
    IF p_direction = 'right' THEN
        IF v_target_major = v_req_role OR v_target_role = v_req_role THEN
            -- CORRECT COLLECT
            INSERT INTO collected_cards (student_id, staff_id)
            VALUES (p_student_id, p_staff_id)
            ON CONFLICT DO NOTHING;

            -- Calculate total collected matching the mission
            SELECT COUNT(*)::INT INTO v_current_collected
            FROM collected_cards cc
            JOIN users u ON cc.staff_id = u.student_id
            WHERE cc.student_id = p_student_id 
              AND (u.major = v_req_role OR u.role = v_req_role);

            IF v_current_collected >= v_req_count THEN
                -- MISSION CLEARED! Chain to next mission
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
                -- Regular collection progress
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
                -- Lockout trigger (exponential cooldown)
                v_cooldown := v_base_cooldown * power(2, v_lock_count);
                IF v_cooldown > v_max_cooldown THEN v_cooldown := v_max_cooldown; END IF;
                v_new_lock_until := NOW() + (v_cooldown * INTERVAL '1 minute');

                UPDATE user_vibe_status 
                SET strike_count = 0,
                    lock_count = lock_count + 1,
                    locked_until = v_new_lock_until
                WHERE student_id = p_student_id;

                RETURN json_build_object(
                    'status', 'locked',
                    'locked_until', v_new_lock_until,
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status 
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

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
            -- MISSED OPPORTUNITY ON CORRECT TARGET (Strike!)
            v_strike_count := v_strike_count + 1;
            IF v_strike_count >= v_max_strikes THEN
                -- Lockout trigger
                v_cooldown := v_base_cooldown * power(2, v_lock_count);
                IF v_cooldown > v_max_cooldown THEN v_cooldown := v_max_cooldown; END IF;
                v_new_lock_until := NOW() + (v_cooldown * INTERVAL '1 minute');

                UPDATE user_vibe_status 
                SET strike_count = 0,
                    lock_count = lock_count + 1,
                    locked_until = v_new_lock_until
                WHERE student_id = p_student_id;

                RETURN json_build_object(
                    'status', 'locked',
                    'locked_until', v_new_lock_until,
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status 
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                RETURN json_build_object(
                    'status', 'strike',
                    'strike_count', v_strike_count,
                    'max_strikes', v_max_strikes
                );
            END IF;
        ELSE
            -- CORRECT SKIP
            RETURN json_build_object(
                'status', 'skipped'
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
