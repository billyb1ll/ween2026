-- 1. Enforce ban in live_chats insert
DROP POLICY IF EXISTS "live_chats_insert" ON public.live_chats;

CREATE POLICY "live_chats_insert" ON public.live_chats
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE student_id = live_chats.student_id)
    AND NOT EXISTS (SELECT 1 FROM public.banned_users WHERE target_user_id = live_chats.student_id)
  );

-- 2. Create RPC for unbanning users
CREATE OR REPLACE FUNCTION moderation_unban_user(
  p_target_user_id TEXT,
  p_staff_id TEXT,
  p_pin_hash TEXT
) RETURNS VOID AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Verify staff
  SELECT role INTO v_role FROM public.users
    WHERE student_id = p_staff_id AND pin_hash = p_pin_hash;
    
  IF v_role IS NULL OR v_role NOT IN ('staff', 'media_admin', 'mod', 'moderator') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Remove ban
  DELETE FROM public.banned_users WHERE target_user_id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
