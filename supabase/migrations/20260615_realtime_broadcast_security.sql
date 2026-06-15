-- Migration: Realtime Broadcast Security and Expired Token Purge
-- File: supabase/migrations/20260615_realtime_broadcast_security.sql

-- 1. Create a security definer function to automatically purge expired user sessions
CREATE OR REPLACE FUNCTION public.purge_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Forcefully revoke and purge all stale, dead, or expired authentication sessions
  DELETE FROM public.user_sessions WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach BEFORE INSERT trigger on realtime.messages to execute prior to access checks
DROP TRIGGER IF EXISTS purge_sessions_trigger ON realtime.messages;
CREATE TRIGGER purge_sessions_trigger
  BEFORE INSERT ON realtime.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_expired_sessions();

-- 3. Ensure RLS is enabled on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- 4. SELECT policy: Allow reading broadcast & presence only if auth.uid() maps to a valid, active user session
DROP POLICY IF EXISTS "authenticated_can_select_messages" ON realtime.messages;
CREATE POLICY "authenticated_can_select_messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_sessions s
    JOIN public.users u ON s.student_id = u.student_id
    WHERE s.session_token = auth.uid()
      AND s.expires_at > NOW()
      AND realtime.messages.extension IN ('broadcast', 'presence')
  )
);

-- 5. INSERT policy: Allow publishing broadcast & presence only if auth.uid() maps to a valid, active user session
DROP POLICY IF EXISTS "authenticated_can_insert_messages" ON realtime.messages;
CREATE POLICY "authenticated_can_insert_messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_sessions s
    JOIN public.users u ON s.student_id = u.student_id
    WHERE s.session_token = auth.uid()
      AND s.expires_at > NOW()
      AND realtime.messages.extension IN ('broadcast', 'presence')
  )
);
