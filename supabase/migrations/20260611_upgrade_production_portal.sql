-- Upgrade Baan 7 Portal to Production-Grade System
-- Migration: 20260611_upgrade_production_portal

-- 1. ALTER USERS TABLE
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_pool TEXT[] DEFAULT '{}'::text[];

-- 2. ALTER POSTS TABLE (Migrate tags to text[] & add liked_by)
-- Drop any default constraints on tags first to prevent type conversion failure
ALTER TABLE posts ALTER COLUMN tags DROP DEFAULT;

-- Alter column with explicit casing fallback
ALTER TABLE posts ALTER COLUMN tags TYPE TEXT[] USING 
  CASE 
    WHEN tags IS NULL THEN '{}'::text[] 
    ELSE tags::text[] 
  END;

-- Set default to array format
ALTER TABLE posts ALTER COLUMN tags SET DEFAULT '{}'::text[];

ALTER TABLE posts ADD COLUMN IF NOT EXISTS liked_by TEXT[] DEFAULT '{}'::text[];

-- 3. CREATE POST COMMENTS TABLE
CREATE TABLE IF NOT EXISTS post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    student_id VARCHAR NOT NULL REFERENCES users(student_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE RLS & CREATE POLICIES ON POST COMMENTS
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all select" ON post_comments;
CREATE POLICY "Allow all select" ON post_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert comments" ON post_comments;
CREATE POLICY "Allow insert comments" ON post_comments FOR INSERT WITH CHECK (true);

-- 5. SECURE DELETION FUNCTIONS (SECURITY DEFINER RPCs)
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
    IF v_post_author = p_student_id OR v_role IN ('superadmin', 'media_admin', 'staff') THEN
        DELETE FROM posts WHERE id = p_post_id;
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to delete this post';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    IF v_comment_author = p_student_id OR v_role IN ('superadmin', 'media_admin', 'staff') THEN
        DELETE FROM post_comments WHERE id = p_comment_id;
        RETURN true;
    ELSE
        RAISE EXCEPTION 'Unauthorized to delete this comment';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
