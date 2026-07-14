-- Update RLS for banned_users to include moderator
DROP POLICY IF EXISTS "banned_users_insert" ON public.banned_users;
CREATE POLICY "banned_users_insert" ON public.banned_users
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE student_id = banned_users.staff_id AND role IN ('mod', 'moderator', 'media_admin', 'staff'))
  );

-- Update RPC for moderation delete to include moderator
CREATE OR REPLACE FUNCTION moderation_delete_message(
  p_message_id UUID,
  p_staff_id TEXT,
  p_pin_hash TEXT
) RETURNS VOID AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users
    WHERE student_id = p_staff_id AND pin_hash = p_pin_hash;
    
  IF v_role IS NULL OR v_role NOT IN ('mod', 'moderator', 'media_admin', 'staff') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  UPDATE public.live_chats SET is_deleted = true WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RPC for moderation ban to include moderator
CREATE OR REPLACE FUNCTION moderation_ban_user(
  p_target_user_id TEXT,
  p_reason TEXT,
  p_staff_id TEXT,
  p_pin_hash TEXT
) RETURNS VOID AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users
    WHERE student_id = p_staff_id AND pin_hash = p_pin_hash;
    
  IF v_role IS NULL OR v_role NOT IN ('mod', 'moderator', 'media_admin', 'staff') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  INSERT INTO public.banned_users (target_user_id, staff_id, reason)
  VALUES (p_target_user_id, p_staff_id, p_reason)
  ON CONFLICT (target_user_id) DO UPDATE SET 
    staff_id = EXCLUDED.staff_id,
    reason = EXCLUDED.reason,
    created_at = EXCLUDED.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
