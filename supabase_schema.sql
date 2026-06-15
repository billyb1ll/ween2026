-- Baan 7 Main Portal Supabase Relational Database Schema
-- Run this script in the Supabase SQL Editor to initialize all tables, RLS policies, and seed data.

-- 1. DROP EXISTING TABLES (IF RE-INITIALIZING)
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS gallery_photos CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS event_config CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. CREATE ENTITIES

-- Event Configuration Table
CREATE TABLE event_config (
    key VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    event_time TIMESTAMPTZ NOT NULL
);

-- Users Profile Table
CREATE TABLE users (
    student_id VARCHAR PRIMARY KEY,
    pin_hash VARCHAR, -- Client-side SHA-256 hashed 6-digit PIN code (null means un-registered)
    nickname VARCHAR,
    faculty VARCHAR,
    major VARCHAR,
    ig VARCHAR,
    role VARCHAR DEFAULT 'student' CHECK (role IN ('superadmin', 'media_admin', 'staff', 'student')),
    avatar_color VARCHAR DEFAULT '#496268',
    images TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    bio TEXT,
    profile_pic_url TEXT,
    photo_pool TEXT[] DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hype & Memory Board Posts Table
CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    liked_by TEXT[] DEFAULT '{}'::text[],
    type VARCHAR NOT NULL DEFAULT 'hype' CHECK (type IN ('hype', 'memory')),
    is_anonymous BOOLEAN DEFAULT false,
    is_hidden BOOLEAN DEFAULT false,
    student_id VARCHAR REFERENCES users(student_id) ON DELETE CASCADE,
    tags TEXT[] DEFAULT '{}'::text[],
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post Comments Table
CREATE TABLE post_comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    student_id VARCHAR NOT NULL REFERENCES users(student_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gallery Photos Table
CREATE TABLE gallery_photos (
    id BIGSERIAL PRIMARY KEY,
    src TEXT NOT NULL,
    caption TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    student_id VARCHAR REFERENCES users(student_id) ON DELETE SET NULL,
    author_name VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature Toggle Configurations (System Config)
CREATE TABLE system_config (
    key VARCHAR PRIMARY KEY,
    value BOOLEAN NOT NULL DEFAULT true
);

-- 3. SEED DATABASE ENTRIES

-- Whitelist default testing roles
-- Roles: superadmin, media_admin, staff, student
INSERT INTO users (student_id, role, nickname, faculty, major, avatar_color) VALUES
('6688216', 'superadmin', 'Super Boss', 'Engineering', 'Computer Science', '#7c563f'),
('6688217', 'media_admin', 'Photo Lead', 'Fine Arts', 'Photography', '#496268'),
('6688218', 'staff', 'Staff Team', 'Arts', 'Event Management', '#9d806c'),
('6688219', 'student', NULL, NULL, NULL, '#a38c75'); -- Not yet registered profile

-- Seed a student with pre-hashed PIN: '123456'
-- SHA-256 hash of '123456' is '8d969ee76d243c509a8f3119717a286940004c4e15f226c70b8e4001b6579500'
INSERT INTO users (student_id, role, nickname, faculty, major, pin_hash, avatar_color) VALUES
('6688220', 'student', 'First Junior', 'Science', 'Physics', '8d969ee76d243c509a8f3119717a286940004c4e15f226c70b8e4001b6579500', '#5b6c6b');

-- Seed Vibe Check profiles (students who have completed profiles)
INSERT INTO users (student_id, role, nickname, faculty, major, pin_hash, avatar_color, images, photo_pool, tags, bio) VALUES
('6688221', 'student', 'Elena', 'Architecture', 'Architecture Major', 'dummy_hash', '#496268', 
  ARRAY['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=700&fit=crop'],
  ARRAY[
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&h=700&fit=crop'
  ], 
  ARRAY['Coffee ☕', 'Night Owl 🦉', 'Adventures'],
  'Architect student who loves sketching buildings and exploring city life.'),

('6688222', 'student', 'Marcus', 'Engineering', 'Computer Science', 'dummy_hash', '#7c563f', 
  ARRAY['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=700&fit=crop'],
  ARRAY[
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&h=700&fit=crop'
  ], 
  ARRAY['Music 🎸', 'Coding', 'Study Buddy'],
  'Developer who spends too much time on side projects and listening to classic rock.'),

('6688223', 'student', 'Sophia', 'Fine Arts', 'Visual Arts', 'dummy_hash', '#8c7b74', 
  ARRAY['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=700&fit=crop'],
  ARRAY[
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&h=700&fit=crop'
  ], 
  ARRAY['Art 🎨', 'Sketching', 'Creative'],
  'Fine arts student specializing in watercolor and portrait drawings.'),

('6688224', 'student', 'Kai', 'Science', 'Environmental Science', 'dummy_hash', '#9d806c', 
  ARRAY['https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=700&fit=crop'],
  ARRAY[
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&h=700&fit=crop'
  ], 
  ARRAY['Nature 🌿', 'Hiking', 'Plants'],
  'Nature enthusiast, plant dad, and amateur photographer.'),

('6688225', 'staff', 'P'' Bell', 'Senior Staff', 'Senior Staff (Baan 7)', 'dummy_hash', '#a38c75', 
  ARRAY['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=700&fit=crop'],
  ARRAY[
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&h=700&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=700&fit=crop'
  ], 
  ARRAY['Staff 🧡', 'Mentor', 'Orientation'],
  'Orientation staff ready to answer all your questions and show you the best spots!');

-- Seed Board Config toggles
INSERT INTO system_config (key, value) VALUES
('enable_hype_board', true),
('enable_memory_board', true);

-- Seed Next Event config
INSERT INTO event_config (key, title, event_time) VALUES
('next_event', 'First Meet', NOW() + INTERVAL '1 day');

-- Seed Initial Board Posts
INSERT INTO posts (content, likes, type, is_anonymous, student_id, tags) VALUES
('Just finished the campus tour. The new science building looks amazing! Can''t wait for classes to start. 🔥', 24, 'hype', false, '6688222', ARRAY['#Ween2026']),
('Welcome incoming freshmen! Make sure to attend the opening ceremony tomorrow at 9 AM in the main hall. It''s going to be spectacular.', 102, 'hype', false, '6688225', ARRAY['#Hype']),
('Look at the beautiful sunrise over the clock tower! Excited to capture more orientation photos.', 15, 'memory', false, '6688217', ARRAY['#Memory']),
('Feeling super pumped to meet everyone! Shoutout to the organizers! 🚀', 8, 'hype', true, '6688220', ARRAY['#Ween2026']);

-- Seed Gallery Images
INSERT INTO gallery_photos (src, caption, likes, student_id, author_name) VALUES
('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=400&fit=crop', 'First day squad!', 56, '6688221', 'Elena'),
('https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=600&h=400&fit=crop', 'Campus sunset 🌅', 89, '6688222', 'Marcus'),
('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&h=400&fit=crop', 'Opening ceremony prep', 134, '6688225', 'P'' Bell'),
('https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=600&h=400&fit=crop', 'Team building games', 72, '6688221', 'Elena'),
('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop', 'Study group vibes', 45, '6688224', 'Kai'),
('https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=400&fit=crop', 'Tech workshop', 67, '6688222', 'Marcus'),
('https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=600&h=400&fit=crop', 'Game night mayhem 🎮', 98, '6688220', 'First Junior'),
('https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop', 'Baan 7 forever!', 201, '6688223', 'Sophia');

-- 4. ROW LEVEL SECURITY (RLS) & TRIGGERS CONFIG
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select" ON users FOR SELECT USING (true);
CREATE POLICY "Allow all select" ON posts FOR SELECT USING (true);
CREATE POLICY "Allow all select" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Allow all select" ON system_config FOR SELECT USING (true);
CREATE POLICY "Allow all select" ON event_config FOR SELECT USING (true);

CREATE POLICY "Allow insert/update users" ON users FOR ALL USING (true);
CREATE POLICY "Allow insert posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert comments" ON post_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all for all config" ON event_config FOR ALL USING (true);

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
