-- Migration: Admin VibeCheck Management
-- Adds secure RPCs for moderators to reset vibecheck progress and set specific missions

CREATE OR REPLACE FUNCTION admin_reset_vibecheck(p_admin_id VARCHAR, p_target_id VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role VARCHAR;
    v_first_mission_id BIGINT;
BEGIN
    -- 1. Verify admin is a moderator
    SELECT role INTO v_admin_role FROM users WHERE student_id = p_admin_id;
    
    IF v_admin_role != 'moderator' THEN
        RAISE EXCEPTION 'Unauthorized: Only moderators can reset VibeCheck progress';
    END IF;
    
    -- 2. Get the first mission (lowest sequence order)
    SELECT id INTO v_first_mission_id FROM vibe_missions ORDER BY sequence_order ASC LIMIT 1;
    
    -- 3. Reset progress
    -- Delete all collected cards for this student
    DELETE FROM collected_cards WHERE student_id = p_target_id;
    
    -- Update user_vibe_status
    UPDATE user_vibe_status 
    SET 
        current_mission_id = v_first_mission_id,
        strike_count = 0,
        lock_count = 0,
        locked_until = NULL
    WHERE student_id = p_target_id;
    
    -- If no status existed, insert it
    IF NOT FOUND THEN
        INSERT INTO user_vibe_status (student_id, current_mission_id, strike_count, lock_count, locked_until)
        VALUES (p_target_id, v_first_mission_id, 0, 0, NULL);
    END IF;
    
    -- 4. Log the action
    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'RESET_VIBECHECK', p_target_id, 'Reset vibecheck progress (cleared cards, strikes, and locks)');
    
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_mission(p_admin_id VARCHAR, p_target_id VARCHAR, p_mission_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role VARCHAR;
    v_mission_exists BOOLEAN;
BEGIN
    -- 1. Verify admin is a moderator
    SELECT role INTO v_admin_role FROM users WHERE student_id = p_admin_id;
    
    IF v_admin_role != 'moderator' THEN
        RAISE EXCEPTION 'Unauthorized: Only moderators can set VibeCheck missions';
    END IF;
    
    -- 2. Verify mission exists
    SELECT EXISTS(SELECT 1 FROM vibe_missions WHERE id = p_mission_id) INTO v_mission_exists;
    IF NOT v_mission_exists THEN
        RAISE EXCEPTION 'Invalid mission ID';
    END IF;
    
    -- 3. Update user_vibe_status 
    UPDATE user_vibe_status 
    SET 
        current_mission_id = p_mission_id,
        strike_count = 0,
        lock_count = 0,
        locked_until = NULL
    WHERE student_id = p_target_id;
    
    -- If no status existed, insert it
    IF NOT FOUND THEN
        INSERT INTO user_vibe_status (student_id, current_mission_id, strike_count, lock_count, locked_until)
        VALUES (p_target_id, p_mission_id, 0, 0, NULL);
    END IF;
    
    -- 4. Log the action
    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'SET_MISSION', p_target_id, 'Set current_mission_id to ' || p_mission_id);
    
END;
$$;
