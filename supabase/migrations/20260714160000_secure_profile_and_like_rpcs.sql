-- 1. Create update_user_profile_secure
CREATE OR REPLACE FUNCTION update_user_profile_secure(
    p_student_id TEXT,
    p_nickname TEXT,
    p_faculty TEXT,
    p_major TEXT,
    p_ig TEXT,
    p_avatar_color TEXT,
    p_bio TEXT,
    p_profile_pic_url TEXT,
    p_photo_pool JSONB,
    p_house_position TEXT,
    p_immich_asset_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify the student_id is valid
    IF NOT EXISTS (SELECT 1 FROM users WHERE student_id = p_student_id) THEN
        RETURN FALSE;
    END IF;

    UPDATE users
    SET 
        nickname = COALESCE(p_nickname, nickname),
        faculty = COALESCE(p_faculty, faculty),
        major = COALESCE(p_major, major),
        ig = COALESCE(p_ig, ig),
        avatar_color = COALESCE(p_avatar_color, avatar_color),
        bio = COALESCE(p_bio, bio),
        profile_pic_url = COALESCE(p_profile_pic_url, profile_pic_url),
        photo_pool = COALESCE(p_photo_pool, photo_pool),
        house_position = COALESCE(p_house_position, house_position),
        immich_asset_id = COALESCE(p_immich_asset_id, immich_asset_id)
    WHERE student_id = p_student_id;

    RETURN TRUE;
END;
$$;

-- 2. Create toggle_post_like
CREATE OR REPLACE FUNCTION toggle_post_like(
    p_post_id UUID,
    p_student_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_liked_by TEXT[];
BEGIN
    -- Get current liked_by array
    SELECT liked_by INTO v_liked_by FROM memory_board_posts WHERE id = p_post_id;
    
    IF v_liked_by IS NULL THEN
        v_liked_by := ARRAY[]::TEXT[];
    END IF;

    IF p_student_id = ANY(v_liked_by) THEN
        -- Remove like
        UPDATE memory_board_posts
        SET 
            liked_by = array_remove(liked_by, p_student_id),
            likes = GREATEST(likes - 1, 0)
        WHERE id = p_post_id;
    ELSE
        -- Add like
        UPDATE memory_board_posts
        SET 
            liked_by = array_append(liked_by, p_student_id),
            likes = likes + 1
        WHERE id = p_post_id;
    END IF;

    RETURN TRUE;
END;
$$;

-- 3. Fix verify_user_login permissions for frontend login
GRANT EXECUTE ON FUNCTION public.verify_user_login TO anon;
GRANT EXECUTE ON FUNCTION public.verify_user_login TO authenticated;
