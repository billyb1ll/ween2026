-- =============================================================================
-- Migration: Superadmin Immutability Guard — Student ID 6688216
-- Date: 2026-07-13
-- Purpose: Prevent any actor (moderator, staff, or direct DB update) from
--          deleting, banning, demoting, or modifying the protected superadmin
--          account. This account is the root moderator and its integrity is
--          critical for system recovery and emergency administration.
-- Protection layers:
--   1. RLS policy blocks direct DELETE on users table for this account
--   2. RLS policy blocks direct UPDATE on users table for this account
--   3. admin_update_user_profile RPC rejects targeting this account
--   4. moderation_ban_user RPC rejects banning this account
--   5. admin_reset_vibecheck RPC rejects targeting this account
--   6. Audit log records this protection being applied
-- =============================================================================

-- =============================================================================
-- STEP 1: Enforce correct role and ensure the record is intact
-- =============================================================================

UPDATE public.users
SET role = 'moderator'
WHERE student_id = '6688216'
  AND role != 'moderator';

-- =============================================================================
-- STEP 2: Remove from banned_users if erroneously present
-- =============================================================================

DELETE FROM public.banned_users
WHERE target_user_id = '6688216';

-- =============================================================================
-- STEP 3: RLS guard — Block direct DELETE and UPDATE on users table
-- =============================================================================

DROP POLICY IF EXISTS "deny_delete_superadmin" ON public.users;
CREATE POLICY "deny_delete_superadmin"
  ON public.users
  FOR DELETE
  USING (student_id != '6688216');

DROP POLICY IF EXISTS "deny_role_downgrade_superadmin" ON public.users;
CREATE POLICY "deny_role_downgrade_superadmin"
  ON public.users
  FOR UPDATE
  USING (student_id != '6688216')
  WITH CHECK (student_id != '6688216');

-- =============================================================================
-- STEP 4: Patch admin_update_user_profile — block targeting the superadmin
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_admin_id       VARCHAR,
  p_admin_pin      VARCHAR,
  p_target_id      VARCHAR,
  p_new_role       TEXT,
  p_nickname       TEXT,
  p_faculty        TEXT,
  p_major          TEXT,
  p_house_position TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_role    VARCHAR;
    v_allowed_roles TEXT[] := ARRAY['student', 'staff', 'moderator', 'media_admin'];
BEGIN
    SELECT role INTO v_admin_role
    FROM users
    WHERE student_id = p_admin_id AND pin_hash = p_admin_pin;

    IF v_admin_role IS NULL OR v_admin_role NOT IN ('moderator', 'media_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient role or invalid credentials';
    END IF;

    -- SUPERADMIN PROTECTION: No actor may modify account 6688216
    IF p_target_id = '6688216' THEN
        RAISE EXCEPTION 'Protected: This account cannot be modified by any actor';
    END IF;

    IF p_new_role IS NOT NULL AND NOT (p_new_role = ANY(v_allowed_roles)) THEN
        RAISE EXCEPTION 'Invalid role value: %', p_new_role;
    END IF;

    IF v_admin_role = 'moderator' AND p_new_role = 'media_admin' THEN
        RAISE EXCEPTION 'Unauthorized: Moderators cannot assign media_admin role';
    END IF;

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
-- STEP 5: Patch moderation_ban_user — block banning the superadmin
-- =============================================================================

CREATE OR REPLACE FUNCTION public.moderation_ban_user(
  p_target_user_id TEXT,
  p_reason         TEXT,
  p_staff_id       TEXT,
  p_pin_hash       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users
    WHERE student_id = p_staff_id AND pin_hash = p_pin_hash;

  IF v_role IS NULL OR v_role NOT IN ('moderator', 'staff') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- SUPERADMIN PROTECTION: Cannot ban account 6688216
  IF p_target_user_id = '6688216' THEN
    RAISE EXCEPTION 'Protected: This account cannot be banned';
  END IF;

  INSERT INTO public.banned_users (target_user_id, staff_id, reason)
  VALUES (p_target_user_id, p_staff_id, p_reason)
  ON CONFLICT (target_user_id) DO UPDATE SET
    staff_id   = EXCLUDED.staff_id,
    reason     = EXCLUDED.reason,
    created_at = EXCLUDED.created_at;
END;
$$;

-- =============================================================================
-- STEP 6: Patch admin_reset_vibecheck — block targeting the superadmin
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_reset_vibecheck(
  p_admin_id  VARCHAR,
  p_admin_pin VARCHAR,
  p_target_id VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_role     VARCHAR;
    v_first_mission  BIGINT;
    v_queue          BIGINT[];
BEGIN
    SELECT role INTO v_admin_role
    FROM users
    WHERE student_id = p_admin_id AND pin_hash = p_admin_pin;

    IF v_admin_role IS NULL OR v_admin_role NOT IN ('moderator', 'media_admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient role or invalid credentials';
    END IF;

    -- SUPERADMIN PROTECTION: Cannot reset vibecheck of account 6688216
    IF p_target_id = '6688216' THEN
        RAISE EXCEPTION 'Protected: This account cannot be modified by any actor';
    END IF;

    SELECT array_agg(id ORDER BY random()) INTO v_queue FROM vibe_missions;

    IF v_queue IS NOT NULL AND array_length(v_queue, 1) > 0 THEN
        v_first_mission := v_queue[1];
        v_queue         := v_queue[2:array_length(v_queue, 1)];
    ELSE
        v_first_mission := NULL;
    END IF;

    DELETE FROM collected_cards WHERE student_id = p_target_id;

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
-- STEP 7: Audit log — record this protection being applied
-- =============================================================================

INSERT INTO public.audit_logs (moderator_id, action_type, target_id, details)
VALUES (
  '6688216',
  'SYSTEM_SUPERADMIN_LOCK',
  '6688216',
  'Superadmin immutability guard applied via migration 20260713_protect_superadmin_6688216. Account 6688216 is now protected from deletion, role changes, and banning by any actor.'
);
