DROP TABLE IF EXISTS public.live_chats CASCADE;

CREATE TABLE public.live_chats (
  id          UUID PRIMARY KEY,
  content     TEXT NOT NULL CHECK (char_length(content) <= 200),
  student_id  TEXT NOT NULL REFERENCES public.users(student_id),
  tab         TEXT NOT NULL DEFAULT 'hype' CHECK (tab IN ('hype', 'memory')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast chronological queries
CREATE INDEX IF NOT EXISTS idx_live_chats_tab_created ON public.live_chats (tab, created_at DESC);

-- RLS: anyone can read, only authenticated users can insert
ALTER TABLE public.live_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_chats_select" ON public.live_chats
  FOR SELECT USING (true);

CREATE POLICY "live_chats_insert" ON public.live_chats
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE student_id = live_chats.student_id)
  );

-- Staff deletion via RPC
CREATE OR REPLACE FUNCTION delete_chat_message_secure(
  p_message_id UUID,
  p_student_id TEXT,
  p_pin_hash TEXT
) RETURNS VOID AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users
    WHERE student_id = p_student_id AND pin_hash = p_pin_hash;
  IF v_role IS NULL OR v_role = 'student' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM public.live_chats WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate realtime security policies to allow live_chat topics (WS Broadcast + Presence)
DROP POLICY IF EXISTS "authenticated_can_select_messages" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated_can_insert_messages" ON realtime.messages;

CREATE POLICY "authenticated_can_select_messages"
ON realtime.messages
FOR SELECT
TO authenticated, anon
USING (
  realtime.messages.extension IN ('broadcast', 'presence', 'postgres_changes')
  AND (
    realtime.messages.topic LIKE 'board:%:stream' OR
    realtime.messages.topic = 'board:global:presence' OR
    realtime.messages.topic LIKE 'global-comment-counts-%' OR
    realtime.messages.topic LIKE 'live_chat:%'
  )
);

CREATE POLICY "authenticated_can_insert_messages"
ON realtime.messages
FOR INSERT
TO authenticated, anon
WITH CHECK (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND (
    realtime.messages.topic LIKE 'board:%:stream' OR
    realtime.messages.topic = 'board:global:presence' OR
    realtime.messages.topic LIKE 'global-comment-counts-%' OR
    realtime.messages.topic LIKE 'live_chat:%'
  )
);

