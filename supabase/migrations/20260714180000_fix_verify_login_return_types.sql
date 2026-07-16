-- =============================================================================
-- Migration: Fix verify_user_login return type mismatch (VARCHAR vs TEXT)
-- Date: 2026-07-14
-- Problem: Function declared return columns as TEXT but users table uses VARCHAR.
--          PostgreSQL throws type mismatch error (400 from Supabase PostgREST).
-- Fix: Drop and recreate with correct VARCHAR types matching the users table.
-- =============================================================================

DROP FUNCTION IF EXISTS public.verify_user_login(VARCHAR, VARCHAR);

CREATE FUNCTION public.verify_user_login(
  p_student_id VARCHAR,
  p_pin_hash   VARCHAR
)
RETURNS TABLE (
  student_id       VARCHAR,
  role             VARCHAR,
  nickname         VARCHAR,
  faculty          VARCHAR,
  major            VARCHAR,
  house_position   VARCHAR,
  avatar_color     VARCHAR,
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

GRANT EXECUTE ON FUNCTION public.verify_user_login TO anon;
GRANT EXECUTE ON FUNCTION public.verify_user_login TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_login TO service_role;
