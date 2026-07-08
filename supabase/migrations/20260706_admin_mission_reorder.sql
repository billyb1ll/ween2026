-- Migration: Admin Mission Reorder
-- Adds secure RPC for moderators to delete a mission and recalculate sequence_order

CREATE OR REPLACE FUNCTION admin_delete_mission_reorder(p_admin_id VARCHAR, p_mission_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role VARCHAR;
    v_seq_order INT;
    v_next_mission_id BIGINT;
BEGIN
    -- 1. Verify admin is a moderator
    SELECT role INTO v_admin_role FROM users WHERE student_id = p_admin_id;
    
    IF v_admin_role != 'moderator' THEN
        RAISE EXCEPTION 'Unauthorized: Only moderators can delete and reorder missions';
    END IF;
    
    -- 2. Get sequence order of the mission to be deleted
    SELECT sequence_order INTO v_seq_order FROM vibe_missions WHERE id = p_mission_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid mission ID';
    END IF;
    
    -- 3. Find the next mission id
    SELECT id INTO v_next_mission_id 
    FROM vibe_missions 
    WHERE sequence_order > v_seq_order 
    ORDER BY sequence_order ASC 
    LIMIT 1;
    
    -- Fallback: if no next mission, find the first available mission (excluding the one being deleted)
    IF v_next_mission_id IS NULL THEN
        SELECT id INTO v_next_mission_id 
        FROM vibe_missions 
        WHERE id != p_mission_id 
        ORDER BY sequence_order ASC 
        LIMIT 1;
    END IF;
    
    -- 4. Reassign active users to the next mission (or NULL if no missions left)
    UPDATE user_vibe_status 
    SET current_mission_id = v_next_mission_id
    WHERE current_mission_id = p_mission_id;
    
    -- 5. Delete the target mission
    DELETE FROM vibe_missions WHERE id = p_mission_id;
    
    -- 6. Recalculate sequence_order for remaining missions
    WITH numbered AS (
        SELECT id, row_number() over (ORDER BY sequence_order ASC) as new_seq
        FROM vibe_missions
    )
    UPDATE vibe_missions vm
    SET sequence_order = n.new_seq
    FROM numbered n
    WHERE vm.id = n.id;
    
    -- 7. Log the action
    INSERT INTO audit_logs (moderator_id, action_type, target_id, details)
    VALUES (p_admin_id, 'DELETE_MISSION_REORDER', p_mission_id::text, 'Deleted mission ' || p_mission_id || ' (Seq: ' || v_seq_order || ') and reordered sequence.');
    
END;
$$;
