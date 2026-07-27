-- Fix toggle_post_like RPC to accept BIGINT post IDs and target public.posts table
DROP FUNCTION IF EXISTS public.toggle_post_like(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.toggle_post_like(
    p_post_id BIGINT,
    p_student_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_liked_by TEXT[];
BEGIN
    SELECT liked_by INTO v_liked_by FROM posts WHERE id = p_post_id;
    
    IF v_liked_by IS NULL THEN
        v_liked_by := ARRAY[]::TEXT[];
    END IF;

    IF p_student_id = ANY(v_liked_by) THEN
        UPDATE posts
        SET 
            liked_by = array_remove(liked_by, p_student_id),
            likes = GREATEST(likes - 1, 0)
        WHERE id = p_post_id;
    ELSE
        UPDATE posts
        SET 
            liked_by = array_append(liked_by, p_student_id),
            likes = likes + 1
        WHERE id = p_post_id;
    END IF;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_post_like(BIGINT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.toggle_post_like(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_like(BIGINT, TEXT) TO service_role;
