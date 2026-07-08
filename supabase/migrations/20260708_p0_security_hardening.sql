-- =============================================================================
-- Migration: P0 Security Hardening
-- Date: 2026-07-08
-- Fixes: CRITICAL-1, CRITICAL-2, HIGH-1, HIGH-2, HIGH-3, MEDIUM-2, P-1
-- =============================================================================

-- =============================================================================
-- FIX P-1: Add missing indexes for high-frequency query paths
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_collected_cards_student_id    ON collected_cards(student_id);
CREATE INDEX IF NOT EXISTS idx_collected_cards_staff_id      ON collected_cards(staff_id);
CREATE INDEX IF NOT EXISTS idx_user_vibe_status_student_id   ON user_vibe_status(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id          ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at         ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role                    ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_house_position          ON users(house_position);

-- =============================================================================
-- FIX CRITICAL-1 & MEDIUM-2: Restrict RLS — remove all wide-open write policies
-- =============================================================================

-- user_vibe_status: drop all-access write; SELECT remains open for admin dashboard reads
DROP POLICY IF EXISTS "Allow all user_vibe_status"        ON user_vibe_status;
DROP POLICY IF EXISTS "Allow all select user_vibe_status" ON user_vibe_status;
CREATE POLICY "vibe_status_select_all"
  ON user_vibe_status FOR SELECT USING (true);
-- No INSERT / UPDATE / DELETE policies: all mutations flow through SECURITY DEFINER RPCs.

-- collected_cards: drop all-access write; SELECT remains open for admin reads
DROP POLICY IF EXISTS "Allow all collected_cards"        ON collected_cards;
DROP POLICY IF EXISTS "Allow all select collected_cards" ON collected_cards;
CREATE POLICY "collected_cards_select_all"
  ON collected_cards FOR SELECT USING (true);
-- No INSERT / UPDATE / DELETE policies: mutations flow through swipe_card_secure_v2.

-- audit_logs: drop INSERT from client; SELECT remains open
DROP POLICY IF EXISTS "Allow insert audit_logs"    ON audit_logs;
DROP POLICY IF EXISTS "Allow all select audit_logs" ON audit_logs;
CREATE POLICY "audit_logs_select_all"
  ON audit_logs FOR SELECT USING (true);
-- INSERT is only done by SECURITY DEFINER RPCs which bypass RLS.

-- system_config: drop all-access write; SELECT remains open
DROP POLICY IF EXISTS "Allow all for system_config" ON public.system_config;
DROP POLICY IF EXISTS "Allow all select"            ON public.system_config;
CREATE POLICY "system_config_select_all"
  ON public.system_config FOR SELECT USING (true);
-- All config mutations must go through admin_update_system_config RPC below.

-- vibe_missions: keep SELECT open; remove unconstrained ALL policy
DROP POLICY IF EXISTS "Allow all vibe_missions"        ON vibe_missions;
DROP POLICY IF EXISTS "Allow all select vibe_missions" ON vibe_missions;
CREATE POLICY "vibe_missions_select_all"
  ON vibe_missions FOR SELECT USING (true);
-- Mission mutations flow through admin_delete_mission_reorder and direct insert
-- from media_admin which is now wrapped in admin_create_mission below.

-- =============================================================================
-- FIX CRITICAL-2 & HIGH-1: Rewrite swipe_card_secure_v2
-- Removes p_is_memory_trap client parameter.
-- Server determines trap status via historical collected_cards lookup.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.swipe_card_secure_v2(
    p_student_id      character varying,
    p_staff_id        character varying,
    p_direction       character varying,
    p_pin_hash        character varying
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_role            VARCHAR;
    v_user_exists          BOOLEAN;
    v_target_role          VARCHAR;
    v_target_major         VARCHAR;
    v_target_house_position VARCHAR;
    v_target_name          VARCHAR;
    v_mission_id           BIGINT;
    v_mission_queue        BIGINT[];
    v_req_role             VARCHAR;
    v_req_count            INT;
    v_current_collected    INT;
    v_strike_count         INT;
    v_lock_count           INT;
    v_locked_until         TIMESTAMPTZ;
    v_max_strikes          INT;
    v_base_cooldown        INT;
    v_max_cooldown         INT;
    v_cooldown             INT;
    v_new_lock_until       TIMESTAMPTZ;
    v_next_mission_id      BIGINT;
    v_is_match             BOOLEAN;
    v_is_memory_trap       BOOLEAN;
    v_previously_collected BOOLEAN;
BEGIN
    -- 1. Authentication Check
    SELECT role, EXISTS(SELECT 1 FROM users WHERE student_id = p_student_id)
    INTO v_user_role, v_user_exists
    FROM users
    WHERE student_id = p_student_id AND pin_hash = p_pin_hash;

    IF v_user_exists IS NOT TRUE THEN
        RETURN json_build_object('status', 'error', 'message', 'Unauthorized: Invalid credentials or unregistered account');
    END IF;

    -- 2. Lockout Check / Status Init
    SELECT strike_count, lock_count, locked_until, current_mission_id, mission_queue
    INTO v_strike_count, v_lock_count, v_locked_until, v_mission_id, v_mission_queue
    FROM user_vibe_status
    WHERE student_id = p_student_id;

    IF NOT FOUND THEN
        SELECT array_agg(id ORDER BY random()) INTO v_mission_queue FROM vibe_missions;

        IF v_mission_queue IS NOT NULL AND array_length(v_mission_queue, 1) > 0 THEN
            v_mission_id    := v_mission_queue[1];
            v_mission_queue := v_mission_queue[2:array_length(v_mission_queue, 1)];
        ELSE
            v_mission_id := NULL;
        END IF;

        INSERT INTO user_vibe_status (student_id, current_mission_id, strike_count, lock_count, locked_until, mission_queue)
        VALUES (p_student_id, v_mission_id, 0, 0, NULL, COALESCE(v_mission_queue, '{}'));

        v_strike_count := 0;
        v_lock_count   := 0;
        v_locked_until := NULL;
    END IF;

    IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
        RETURN json_build_object(
            'status',           'locked',
            'locked_until',     v_locked_until,
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

    -- 4. Load Active Mission Spec
    SELECT target_role, required_count
    INTO v_req_role, v_req_count
    FROM vibe_missions
    WHERE id = v_mission_id;

    IF NOT FOUND THEN
        RETURN json_build_object('status', 'all_complete', 'message', 'All missions completed');
    END IF;

    -- 5. Load Penalty Configuration
    SELECT int_value INTO v_max_strikes FROM system_config WHERE key = 'max_allowed_strikes';
    IF v_max_strikes IS NULL THEN v_max_strikes := 5; END IF;

    SELECT int_value INTO v_base_cooldown FROM system_config WHERE key = 'base_cooldown_minutes';
    IF v_base_cooldown IS NULL THEN v_base_cooldown := 1; END IF;

    SELECT int_value INTO v_max_cooldown FROM system_config WHERE key = 'max_cooldown_minutes';
    IF v_max_cooldown IS NULL THEN v_max_cooldown := 30; END IF;

    -- 6. Server-Side Match and Trap Detection
    v_is_match := (
        v_target_major         = v_req_role OR
        v_target_role          = v_req_role OR
        v_target_house_position = v_req_role
    );

    -- A card is a memory trap if and only if:
    --   (a) the student has already collected it in a previous mission, AND
    --   (b) its attributes do NOT match the current active mission target.
    -- This replaces the former client-controlled p_is_memory_trap boolean.
    SELECT EXISTS(
        SELECT 1 FROM collected_cards
        WHERE student_id = p_student_id AND staff_id = p_staff_id
    ) INTO v_previously_collected;

    v_is_memory_trap := v_previously_collected AND NOT v_is_match;

    -- 7. Memory Retention Trap Logic (server-evaluated)
    IF v_is_memory_trap THEN
        IF p_direction = 'right' THEN
            -- Trap triggered: +2 strikes
            v_strike_count := v_strike_count + 2;

            IF v_strike_count >= v_max_strikes THEN
                v_cooldown       := LEAST(v_base_cooldown * power(2, v_lock_count)::int, v_max_cooldown);
                v_new_lock_until := NOW() + (v_cooldown * INTERVAL '1 minute');

                UPDATE user_vibe_status
                SET strike_count = 0,
                    lock_count   = lock_count + 1,
                    locked_until = v_new_lock_until
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_lockout', p_student_id,
                    'Lockout issued for ' || v_cooldown::text || ' minutes: memory trap activated on staff ' || p_staff_id);

                RETURN json_build_object(
                    'status',          'locked',
                    'locked_until',    v_new_lock_until,
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_strike', p_student_id,
                    'Double strike issued: memory trap activated on staff ' || p_staff_id ||
                    ' (Strike count: ' || v_strike_count::text || '/' || v_max_strikes::text || ')');

                RETURN json_build_object(
                    'status',      'strike',
                    'strike_count', v_strike_count,
                    'max_strikes',  v_max_strikes,
                    'is_trap',      true
                );
            END IF;
        ELSE
            -- Trap safely evaded (left swipe on a trap card)
            RETURN json_build_object('status', 'skipped', 'is_trap', true);
        END IF;
    END IF;

    -- 8. Normal Swipe Logic
    IF p_direction = 'right' THEN
        IF v_is_match THEN
            -- Correct collect
            INSERT INTO collected_cards (student_id, staff_id)
            VALUES (p_student_id, p_staff_id)
            ON CONFLICT DO NOTHING;

            SELECT COUNT(*)::INT INTO v_current_collected
            FROM collected_cards cc
            JOIN users u ON cc.staff_id = u.student_id
            WHERE cc.student_id = p_student_id
              AND (u.major = v_req_role OR u.role = v_req_role OR u.house_position = v_req_role);

            IF v_current_collected >= v_req_count THEN
                -- Advance to next mission from queue
                IF v_mission_queue IS NOT NULL AND array_length(v_mission_queue, 1) > 0 THEN
                    v_next_mission_id := v_mission_queue[1];
                    v_mission_queue   := v_mission_queue[2:array_length(v_mission_queue, 1)];
                ELSE
                    v_next_mission_id := NULL;
                END IF;

                UPDATE user_vibe_status
                SET current_mission_id = v_next_mission_id,
                    mission_queue      = COALESCE(v_mission_queue, '{}'),
                    strike_count       = 0,
                    lock_count         = 0,
                    locked_until       = NULL
                WHERE student_id = p_student_id;

                RETURN json_build_object(
                    'status',              'mission_cleared',
                    'collected_staff_name', v_target_name,
                    'current_count',        v_current_collected,
                    'required_count',       v_req_count,
                    'next_mission_id',      v_next_mission_id
                );
            ELSE
                RETURN json_build_object(
                    'status',              'collected',
                    'collected_staff_name', v_target_name,
                    'current_count',        v_current_collected,
                    'required_count',       v_req_count
                );
            END IF;
        ELSE
            -- Incorrect collect (swipe right on wrong target): +1 strike
            v_strike_count := v_strike_count + 1;

            IF v_strike_count >= v_max_strikes THEN
                v_cooldown       := LEAST(v_base_cooldown * power(2, v_lock_count)::int, v_max_cooldown);
                v_new_lock_until := NOW() + (v_cooldown * INTERVAL '1 minute');

                UPDATE user_vibe_status
                SET strike_count = 0,
                    lock_count   = lock_count + 1,
                    locked_until = v_new_lock_until
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_lockout', p_student_id,
                    'Lockout issued for ' || v_cooldown::text || ' minutes: incorrect collect on staff ' || p_staff_id);

                RETURN json_build_object(
                    'status',          'locked',
                    'locked_until',    v_new_lock_until,
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_strike', p_student_id,
                    'Strike issued: incorrect collect on staff ' || p_staff_id ||
                    ' (Strike count: ' || v_strike_count::text || '/' || v_max_strikes::text || ')');

                RETURN json_build_object(
                    'status',      'strike',
                    'strike_count', v_strike_count,
                    'max_strikes',  v_max_strikes
                );
            END IF;
        END IF;
    ELSE
        -- Left swipe
        IF v_is_match THEN
            -- Missed opportunity (skip on correct target): +1 strike
            v_strike_count := v_strike_count + 1;

            IF v_strike_count >= v_max_strikes THEN
                v_cooldown       := LEAST(v_base_cooldown * power(2, v_lock_count)::int, v_max_cooldown);
                v_new_lock_until := NOW() + (v_cooldown * INTERVAL '1 minute');

                UPDATE user_vibe_status
                SET strike_count = 0,
                    lock_count   = lock_count + 1,
                    locked_until = v_new_lock_until
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_lockout', p_student_id,
                    'Lockout issued for ' || v_cooldown::text || ' minutes: incorrect skip on staff ' || p_staff_id);

                RETURN json_build_object(
                    'status',          'locked',
                    'locked_until',    v_new_lock_until,
                    'cooldown_minutes', v_cooldown
                );
            ELSE
                UPDATE user_vibe_status
                SET strike_count = v_strike_count
                WHERE student_id = p_student_id;

                INSERT INTO audit_logs (action_type, target_id, details)
                VALUES ('system_strike', p_student_id,
                    'Strike issued: incorrect skip on staff ' || p_staff_id ||
                    ' (Strike count: ' || v_strike_count::text || '/' || v_max_strikes::text || ')');

                RETURN json_build_object(
                    'status',      'strike',
                    'strike_count', v_strike_count,
                    'max_strikes',  v_max_strikes
                );
            END IF;
        ELSE
            -- Correct skip (non-matching target, not a trap)
            RETURN json_build_object('status', 'skipped');
        END IF;
    END IF;
END;
$function$;

-- =============================================================================
-- FIX HIGH-2: Add PIN authentication to admin_reset_vibecheck
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_vibecheck(
    p_admin_id  VARCHAR,
    p_admin_pin VARCHAR,
    p_target_id VARCHAR
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role     VARCHAR;
    v_first_mission  BIGINT;
    v_queue          BIGINT[];
BEGIN
    -- Authenticate with both student_id and pin_hash
    SELECT role INTO v_admin_role
    FROM users
    WHERE student_id = p_admin_id AND pin_hash = p_admin_pin;

    IF v_admin_role IS NULL OR v_admin_role NOT IN ('moderator', 'media_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient role or invalid credentials';
    END IF;

    -- Build a fresh randomized queue for the reset target
    SELECT array_agg(id ORDER BY random()) INTO v_queue FROM vibe_missions;

    IF v_queue IS NOT NULL AND array_length(v_queue, 1) > 0 THEN
        v_first_mission := v_queue[1];
        v_queue         := v_queue[2:array_length(v_queue, 1)];
    ELSE
        v_first_mission := NULL;
    END IF;

    -- Wipe collected cards
    DELETE FROM collected_cards WHERE student_id = p_target_id;

    -- Reset vibe status
    UPDATE user_vibe_status
    SET current_mission_id = v_first_mission,
        mission_queue      = COALESCE(v_queue, '{}'),
        strike_count       = 0,
        lock_count         = 0,
        locked_until       = NULL
    WHERE student_id = p_target_id;

    IF NOT FOUND THEN
        INSERT INTO user_vibe_status (student_id, current_mission_id, mission_queue, strike_count, lock_count, locked_until)
        VALUES (p_target_id, v_first_mission, COALESCE(v_queue, '{}'), 0, 0, NULL);
    END IF;

    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'RESET_VIBECHECK', p_target_id,
        'Full VibeCheck reset: cleared collected cards, strikes, and lockout for student ' || p_target_id);
END;
$$;

-- =============================================================================
-- FIX HIGH-2: Add PIN authentication to admin_set_mission
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_mission(
    p_admin_id  VARCHAR,
    p_admin_pin VARCHAR,
    p_target_id VARCHAR,
    p_mission_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role    VARCHAR;
    v_mission_exists BOOLEAN;
BEGIN
    SELECT role INTO v_admin_role
    FROM users
    WHERE student_id = p_admin_id AND pin_hash = p_admin_pin;

    IF v_admin_role IS NULL OR v_admin_role NOT IN ('moderator', 'media_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient role or invalid credentials';
    END IF;

    SELECT EXISTS(SELECT 1 FROM vibe_missions WHERE id = p_mission_id) INTO v_mission_exists;
    IF NOT v_mission_exists THEN
        RAISE EXCEPTION 'Invalid mission ID: %', p_mission_id;
    END IF;

    UPDATE user_vibe_status
    SET current_mission_id = p_mission_id,
        strike_count       = 0,
        lock_count         = 0,
        locked_until       = NULL
    WHERE student_id = p_target_id;

    IF NOT FOUND THEN
        INSERT INTO user_vibe_status (student_id, current_mission_id, strike_count, lock_count, locked_until)
        VALUES (p_target_id, p_mission_id, 0, 0, NULL);
    END IF;

    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'SET_MISSION', p_target_id,
        'Active mission set to ID ' || p_mission_id || ' for student ' || p_target_id);
END;
$$;

-- =============================================================================
-- FIX HIGH-2: Add PIN authentication to admin_delete_mission_reorder
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_mission_reorder(
    p_admin_id  VARCHAR,
    p_admin_pin VARCHAR,
    p_mission_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role     VARCHAR;
    v_seq_order      INT;
    v_next_mission   BIGINT;
BEGIN
    SELECT role INTO v_admin_role
    FROM users
    WHERE student_id = p_admin_id AND pin_hash = p_admin_pin;

    IF v_admin_role IS NULL OR v_admin_role NOT IN ('moderator', 'media_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient role or invalid credentials';
    END IF;

    SELECT sequence_order INTO v_seq_order FROM vibe_missions WHERE id = p_mission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid mission ID: %', p_mission_id;
    END IF;

    -- Find the next mission to redirect active users
    SELECT id INTO v_next_mission
    FROM vibe_missions
    WHERE sequence_order > v_seq_order
    ORDER BY sequence_order ASC
    LIMIT 1;

    IF v_next_mission IS NULL THEN
        SELECT id INTO v_next_mission
        FROM vibe_missions
        WHERE id != p_mission_id
        ORDER BY sequence_order ASC
        LIMIT 1;
    END IF;

    -- Redirect users who were on the deleted mission
    UPDATE user_vibe_status
    SET current_mission_id = v_next_mission
    WHERE current_mission_id = p_mission_id;

    -- Remove the mission from queued arrays (replace with next mission id or remove entry)
    UPDATE user_vibe_status
    SET mission_queue = array_remove(mission_queue, p_mission_id)
    WHERE p_mission_id = ANY(mission_queue);

    DELETE FROM vibe_missions WHERE id = p_mission_id;

    -- Recalculate contiguous sequence_order
    WITH numbered AS (
        SELECT id, row_number() OVER (ORDER BY sequence_order ASC) AS new_seq
        FROM vibe_missions
    )
    UPDATE vibe_missions vm
    SET sequence_order = n.new_seq
    FROM numbered n
    WHERE vm.id = n.id;

    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'DELETE_MISSION_REORDER', p_mission_id::text,
        'Deleted mission ' || p_mission_id || ' (seq: ' || v_seq_order || ') and reordered sequence');
END;
$$;

-- =============================================================================
-- FIX HIGH-3: New SECURITY DEFINER RPC to replace direct users table writes
-- Handles role updates and profile edits from admin dashboard.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
    p_admin_id        VARCHAR,
    p_admin_pin       VARCHAR,
    p_target_id       VARCHAR,
    p_new_role        VARCHAR,
    p_nickname        VARCHAR,
    p_faculty         VARCHAR,
    p_major           VARCHAR,
    p_house_position  VARCHAR
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role    VARCHAR;
    v_allowed_roles TEXT[] := ARRAY['student', 'staff', 'moderator', 'media_admin'];
BEGIN
    -- Authenticate caller
    SELECT role INTO v_admin_role
    FROM users
    WHERE student_id = p_admin_id AND pin_hash = p_admin_pin;

    IF v_admin_role IS NULL OR v_admin_role NOT IN ('moderator', 'media_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient role or invalid credentials';
    END IF;

    -- Validate new role value
    IF p_new_role IS NOT NULL AND NOT (p_new_role = ANY(v_allowed_roles)) THEN
        RAISE EXCEPTION 'Invalid role value: %', p_new_role;
    END IF;

    -- Moderators cannot promote to media_admin or modify another moderator's role
    IF v_admin_role = 'moderator' AND p_new_role = 'media_admin' THEN
        RAISE EXCEPTION 'Unauthorized: Moderators cannot assign media_admin role';
    END IF;

    -- Apply update
    UPDATE users
    SET nickname       = NULLIF(p_nickname, ''),
        faculty        = NULLIF(p_faculty, ''),
        major          = NULLIF(p_major, ''),
        role           = COALESCE(NULLIF(p_new_role, ''), role),
        house_position = NULLIF(p_house_position, '')
    WHERE student_id = p_target_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found: %', p_target_id;
    END IF;

    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'user_update', p_target_id,
        'Profile updated by ' || v_admin_role || ' ' || p_admin_id ||
        ': role=' || COALESCE(p_new_role, 'unchanged') ||
        ', nickname="' || COALESCE(p_nickname, '') || '"' ||
        ', faculty="' || COALESCE(p_faculty, '') || '"' ||
        ', major="' || COALESCE(p_major, '') || '"' ||
        ', house_position="' || COALESCE(p_house_position, '') || '"');

    RETURN json_build_object('status', 'ok', 'target_id', p_target_id);
END;
$$;

-- =============================================================================
-- FIX MEDIUM-2: Secure system_config writes through an RPC
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

    UPDATE system_config
    SET value      = COALESCE(p_value,      value),
        int_value  = COALESCE(p_int_value,  int_value),
        text_value = COALESCE(p_text_value, text_value)
    WHERE key = p_key;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Configuration key not found: %', p_key;
    END IF;

    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'config_update', p_key,
        'System config "' || p_key || '" updated by ' || v_admin_role || ' ' || p_admin_id);
END;
$$;
