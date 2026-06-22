-- Migration: Realtime Replication Enablement for users, live_chats, and collected_cards tables
-- File: supabase/migrations/20260621_realtime_replication_users_chats.sql

-- 1. Add tables to the existing supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE live_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE collected_cards;

-- 2. Configure replica identity to FULL to guarantee complete update payloads are received
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE live_chats REPLICA IDENTITY FULL;
ALTER TABLE collected_cards REPLICA IDENTITY FULL;
