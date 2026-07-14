-- =============================================================================
-- Migration: P0 Salted PIN Hash — verify_user_login RPC Groundwork
-- Date: 2026-07-13
-- Fixes: CRIT-1 (salted PIN hash), CRIT-2 (pin_hash never returned to client)
-- =============================================================================
--
-- IMPORTANT: PIN Hash Migration Notice
-- ============================================================================
-- The client-side hashPin() function has been upgraded to include a per-user
-- salt: SHA-256( studentId + ":" + pin ).
--
-- All existing pin_hash values in the users table were stored WITHOUT a salt.
-- They will no longer match. On the user's next login attempt, their PIN will
-- fail and the LoginPage will guide them through the register_pin flow, which
-- will store the new salted hash. No user data is lost.
-- ============================================================================

-- =============================================================================
-- verify_user_login: Server-side credential verification (DB groundwork)
-- Returns only safe fields — pin_hash is NEVER included in the response.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verify_user_login(
  p_student_id VARCHAR,
  p_pin_hash   VARCHAR
)
RETURNS TABLE (
  student_id       VARCHAR,
  role             TEXT,
  nickname         TEXT,
  faculty          TEXT,
  major            TEXT,
  house_position   TEXT,
  avatar_color     TEXT,
  has_accepted_tos BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Returns only safe, non-sensitive fields. pin_hash is NEVER included.
  RETURN QUERY
  SELECT
    u.student_id,
    u.role,
    u.nickname,
    u.faculty,
    u.major,
    u.house_position,
    u.avatar_color,
    u.has_accepted_tos
  FROM public.users u
  WHERE
    u.student_id = p_student_id
    AND u.pin_hash = p_pin_hash;
END;
$$;

-- Restrict execution to service_role only
REVOKE EXECUTE ON FUNCTION public.verify_user_login FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_user_login FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.verify_user_login TO service_role;

-- =============================================================================
-- users_public: Safe view excluding pin_hash for public-facing queries
-- Columns match the actual production schema (has baan_position, no full_name)
-- =============================================================================

CREATE OR REPLACE VIEW public.users_public AS
  SELECT
    student_id,
    nickname,
    faculty,
    major,
    role,
    avatar_color,
    bio,
    ig,
    images,
    tags,
    profile_pic_url,
    photo_pool,
    baan_position,
    house_position,
    immich_asset_id,
    has_accepted_tos,
    created_at
    -- pin_hash intentionally excluded
  FROM public.users;

GRANT SELECT ON public.users_public TO anon;
GRANT SELECT ON public.users_public TO authenticated;

COMMENT ON VIEW public.users_public IS
  'Public-safe projection of the users table. Excludes pin_hash and other sensitive credential fields.';

