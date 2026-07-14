-- =============================================================================
-- Migration: P3 Secure Profile Claim
-- Date: 2026-07-08
-- Enforces pessimistic concurrency control to prevent double-claiming of user
-- profiles during high-traffic registration.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_profile_secure(
    p_student_id VARCHAR,
    p_pin_hash VARCHAR
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Strict conditional checkpoint: only update if pin_hash is still NULL
    UPDATE users 
    SET pin_hash = p_pin_hash
    WHERE student_id = p_student_id 
      AND pin_hash IS NULL;
    
    -- Throw an explicit database exception if 0 rows were updated 
    -- (meaning someone else just stole the claim a millisecond prior)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_ALREADY_CLAIMED: This profile has already been secured by another participant.';
    END IF;
END;
$$;
