-- Fix update_user_profile_secure to use TEXT[] instead of JSONB for photo_pool
CREATE OR REPLACE FUNCTION update_user_profile_secure(
    p_student_id TEXT,
    p_nickname TEXT,
    p_faculty TEXT,
    p_major TEXT,
    p_ig TEXT,
    p_avatar_color TEXT,
    p_bio TEXT,
    p_profile_pic_url TEXT,
    p_photo_pool TEXT[],
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
