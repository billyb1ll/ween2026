-- 1. Migrate existing users from media_admin to moderator
UPDATE public.users SET role = 'moderator' WHERE role = 'media_admin';

-- 2. Drop the old constraint and add the new one
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('moderator', 'staff', 'student'));

-- 3. Update banned_users_insert policy
DROP POLICY IF EXISTS "banned_users_insert" ON public.banned_users;
CREATE POLICY "banned_users_insert" ON public.banned_users
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE student_id = banned_users.staff_id AND role IN ('moderator', 'staff'))
  );

-- 4. Update RPC moderation_delete_message
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
    
  IF v_role IS NULL OR v_role NOT IN ('moderator', 'staff') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  UPDATE public.live_chats SET is_deleted = true WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update RPC moderation_ban_user
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
    
  IF v_role IS NULL OR v_role NOT IN ('moderator', 'staff') THEN
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
