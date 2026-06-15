-- ====================================================================
-- MASTER PRODUCTION REALTIME REPLICATION OPTIMIZATION (BAAN 7 PORTAL)
-- ====================================================================

-- 1. Ensure clean slate by dropping the "FOR ALL TABLES" publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- 2. Create the publication selectively for only the verified mission-critical tables
CREATE PUBLICATION supabase_realtime FOR TABLE posts, system_config, post_comments;

-- 3. Set the owner to postgres (required for Supabase dashboard integration)
ALTER PUBLICATION supabase_realtime OWNER TO postgres;

-- 4. Ensure proper replica identity (FULL) for active event tables to guarantee complete payloads
ALTER TABLE posts REPLICA IDENTITY FULL;
ALTER TABLE post_comments REPLICA IDENTITY FULL;
ALTER TABLE system_config REPLICA IDENTITY FULL;

-- Verification Sign-off Check: Confirm target tables now read "✓ Enabled" inside dashboard panels.
