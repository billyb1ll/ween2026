-- =============================================================================
-- Migration: Full PIN Hash Reset for Salted Hash Migration
-- Date: 2026-07-14
-- Reason: The hashPin() function was upgraded from SHA-256(pin) to
--         SHA-256(studentId + ":" + pin). All previously stored pin_hash
--         values are permanently invalid under the new scheme.
-- Effect: All users will be prompted to re-register their PIN on next login.
--         Existing sessions are invalidated to force a clean re-authentication.
-- =============================================================================

-- Step 1: Record how many PINs and sessions will be cleared
DO $$
DECLARE
  v_pin_count INT;
  v_session_count INT;
BEGIN
  SELECT COUNT(*) INTO v_pin_count FROM public.users WHERE pin_hash IS NOT NULL;
  SELECT COUNT(*) INTO v_session_count FROM public.user_sessions;

  -- Use superadmin ID '6688216' as the system actor (satisfies FK constraint)
  INSERT INTO public.audit_logs (moderator_id, action_type, target_id, details)
  VALUES (
    '6688216',
    'SYSTEM_PIN_RESET',
    'ALL_USERS',
    'Salted PIN hash migration: clearing ' || v_pin_count || ' pin_hash values and ' ||
    v_session_count || ' active sessions. Users must re-register PIN on next login.'
  );
END;
$$;

-- Step 2: Null all pin_hash values across all users
UPDATE public.users
SET pin_hash = NULL;

-- Step 3: Invalidate all active sessions — forces fresh re-authentication
DELETE FROM public.user_sessions;

-- Step 4: Verify the reset is complete (raises exception if anything remains)
DO $$
DECLARE
  v_remaining_pins INT;
  v_remaining_sessions INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining_pins FROM public.users WHERE pin_hash IS NOT NULL;
  SELECT COUNT(*) INTO v_remaining_sessions FROM public.user_sessions;

  IF v_remaining_pins > 0 THEN
    RAISE EXCEPTION 'PIN reset incomplete: % pin_hash values still set', v_remaining_pins;
  END IF;

  IF v_remaining_sessions > 0 THEN
    RAISE EXCEPTION 'Session wipe incomplete: % sessions still active', v_remaining_sessions;
  END IF;

  INSERT INTO public.audit_logs (moderator_id, action_type, target_id, details)
  VALUES (
    '6688216',
    'SYSTEM_PIN_RESET_CONFIRMED',
    'ALL_USERS',
    'PIN reset verified: 0 pin_hash values remaining, 0 active sessions remaining. System ready for salted PIN re-registration.'
  );
END;
$$;
