-- Migration: Add ToS tracking and VibeCheck Kill Switch

-- 1. Add Terms of Use tracking column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_accepted_tos BOOLEAN DEFAULT false;

-- 2. Add System Settings configuration for VibeCheck kill switch
INSERT INTO system_config (key, value) 
VALUES ('vibecheck_enabled', true) 
ON CONFLICT (key) DO NOTHING;
