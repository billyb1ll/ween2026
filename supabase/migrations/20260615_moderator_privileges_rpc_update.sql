-- Migration: Update secure moderator RPC functions for correct role checking
-- File: supabase/migrations/20260615_moderator_privileges_rpc_update.sql

-- 1. Redefine delete_post_secure to check for 'moderator' instead of 'superadmin'
CREATE OR REPLACE FUNCTION delete_post_secure(p_post_id bigint, p_student_id varchar, p_pin_hash varchar)
RETURNS boolean AS $$
DECLARE
    v_role varchar;
    v_post_author varchar;
BEGIN
    SELECT role INTO v_role FROM users WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid student ID or PIN';
    END IF;
    SELECT student_id INTO v_post_author FROM posts WHERE id = p_post_id;
    IF v_post_author = p_student_id OR v_role IN ('moderator', 'media_admin', 'staff') THEN
        DELETE FROM posts WHERE id = p_post_id;
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to delete this post';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine delete_comment_secure to check for 'moderator' instead of 'superadmin'
CREATE OR REPLACE FUNCTION delete_comment_secure(p_comment_id bigint, p_student_id varchar, p_pin_hash varchar)
RETURNS boolean AS $$
DECLARE
    v_role varchar;
    v_comment_author varchar;
BEGIN
    SELECT role INTO v_role FROM users WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid student ID or PIN';
    END IF;
    SELECT student_id INTO v_comment_author FROM post_comments WHERE id = p_comment_id;
    IF v_comment_author = p_student_id OR v_role IN ('moderator', 'media_admin', 'staff') THEN
        DELETE FROM post_comments WHERE id = p_comment_id;
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to delete this comment';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redefine pin_post_secure to check for 'moderator' instead of 'superadmin'
CREATE OR REPLACE FUNCTION pin_post_secure(p_post_id bigint, p_student_id character varying, p_pin_hash character varying, p_is_pinned boolean)
RETURNS boolean AS $$
DECLARE
    v_role varchar;
BEGIN
    SELECT role INTO v_role FROM users WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Invalid student ID or PIN';
    END IF;
    IF v_role IN ('moderator', 'media_admin', 'staff') THEN
        UPDATE posts SET is_pinned = p_is_pinned WHERE id = p_post_id;
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to pin this post';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
