-- Migration: Token-Based Sessions and Staff House Position
-- Adds house_position column to users and creates user_sessions table.

-- 1. Add house_position to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS house_position VARCHAR;

-- 2. Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    session_token UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id VARCHAR REFERENCES users(student_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. Row Level Security & Access Policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all user_sessions" ON user_sessions;
CREATE POLICY "Allow all user_sessions" ON user_sessions FOR ALL USING (true);
