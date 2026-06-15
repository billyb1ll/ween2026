-- Migration: Realtime Broadcast Security Fix for Anon Connections
-- File: supabase/migrations/20260615_realtime_broadcast_security_fix.sql

-- 1. Ensure RLS is enabled on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "authenticated_can_select_messages" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated_can_insert_messages" ON realtime.messages;

-- 3. SELECT policy: Allow subscribing to private broadcast & presence topics for both authenticated and anon connections
CREATE POLICY "authenticated_can_select_messages"
ON realtime.messages
FOR SELECT
TO authenticated, anon
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (
    realtime.messages.topic LIKE 'board:%:stream' OR
    realtime.messages.topic = 'board:global:presence' OR
    realtime.messages.topic LIKE 'global-comment-counts-%'
  )
);

-- 4. INSERT policy: Allow publishing broadcast & presence only if the payload contains a valid, unexpired session token
CREATE POLICY "authenticated_can_insert_messages"
ON realtime.messages
FOR INSERT
TO authenticated, anon
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND EXISTS (
    SELECT 1
    FROM public.user_sessions s
    WHERE (
      -- Extract session_token from payload (handles direct broadcast payload and nested presence track payload)
      s.session_token::text = (realtime.messages.payload ->> 'session_token') OR
      s.session_token::text = (realtime.messages.payload -> 'payload' ->> 'session_token') OR
      -- Fallback to auth.uid() in case they are logged in via standard Supabase Auth
      s.session_token = auth.uid()
    )
    AND s.expires_at > NOW()
  )
);
