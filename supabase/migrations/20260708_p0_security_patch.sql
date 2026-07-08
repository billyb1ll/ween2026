-- =============================================================================
-- Migration: P0 Security Patch (Linter Fixes)
-- Date: 2026-07-08
-- Fixes: anon_security_definer_function_executable, function_search_path_mutable
-- =============================================================================

-- 1. Drop overloaded functions that still accept old signatures or missing PINs
DROP FUNCTION IF EXISTS public.swipe_card_secure_v2(character varying, character varying, character varying, character varying, boolean);
DROP FUNCTION IF EXISTS public.admin_delete_mission_reorder(character varying, bigint);
DROP FUNCTION IF EXISTS public.admin_reset_vibecheck(character varying, character varying);
DROP FUNCTION IF EXISTS public.admin_set_mission(character varying, character varying, bigint);

-- 2. Set search_path = '' for all SECURITY DEFINER functions and Revoke PUBLIC execute
-- (Revoking from PUBLIC prevents anon execution, granting to authenticated ensures logged-in users can call them)

-- swipe_card_secure_v2
ALTER FUNCTION public.swipe_card_secure_v2(character varying, character varying, character varying, character varying) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.swipe_card_secure_v2(character varying, character varying, character varying, character varying) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.swipe_card_secure_v2(character varying, character varying, character varying, character varying) TO authenticated;

-- admin_reset_vibecheck
ALTER FUNCTION public.admin_reset_vibecheck(character varying, character varying, character varying) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.admin_reset_vibecheck(character varying, character varying, character varying) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_vibecheck(character varying, character varying, character varying) TO authenticated;

-- admin_set_mission
ALTER FUNCTION public.admin_set_mission(character varying, character varying, character varying, bigint) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.admin_set_mission(character varying, character varying, character varying, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_mission(character varying, character varying, character varying, bigint) TO authenticated;

-- admin_delete_mission_reorder
ALTER FUNCTION public.admin_delete_mission_reorder(character varying, character varying, bigint) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.admin_delete_mission_reorder(character varying, character varying, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_mission_reorder(character varying, character varying, bigint) TO authenticated;

-- admin_update_user_profile
ALTER FUNCTION public.admin_update_user_profile(character varying, character varying, character varying, character varying, character varying, character varying, character varying, character varying) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(character varying, character varying, character varying, character varying, character varying, character varying, character varying, character varying) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(character varying, character varying, character varying, character varying, character varying, character varying, character varying, character varying) TO authenticated;

-- admin_update_system_config
ALTER FUNCTION public.admin_update_system_config(character varying, character varying, character varying, boolean, integer, text) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.admin_update_system_config(character varying, character varying, character varying, boolean, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_system_config(character varying, character varying, character varying, boolean, integer, text) TO authenticated;

-- Also fix old functions flagged by the linter
-- broadcast_emergency_message
ALTER FUNCTION public.broadcast_emergency_message(uuid, boolean, text) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.broadcast_emergency_message(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_emergency_message(uuid, boolean, text) TO authenticated;

-- delete_chat_message_secure (uuid session token version)
ALTER FUNCTION public.delete_chat_message_secure(uuid, text, text) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.delete_chat_message_secure(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_chat_message_secure(uuid, text, text) TO authenticated;

-- delete_chat_message_secure (bigint message id version)
ALTER FUNCTION public.delete_chat_message_secure(bigint, text, text) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.delete_chat_message_secure(bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_chat_message_secure(bigint, text, text) TO authenticated;

-- delete_comment_secure
ALTER FUNCTION public.delete_comment_secure(bigint, character varying, character varying) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.delete_comment_secure(bigint, character varying, character varying) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_comment_secure(bigint, character varying, character varying) TO authenticated;

-- delete_post_secure
ALTER FUNCTION public.delete_post_secure(bigint, character varying, character varying) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.delete_post_secure(bigint, character varying, character varying) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_post_secure(bigint, character varying, character varying) TO authenticated;

-- pin_post_secure
ALTER FUNCTION public.pin_post_secure(bigint, character varying, character varying, boolean) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.pin_post_secure(bigint, character varying, character varying, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pin_post_secure(bigint, character varying, character varying, boolean) TO authenticated;

-- swipe_card_secure (v1)
ALTER FUNCTION public.swipe_card_secure(character varying, character varying, character varying, character varying) SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.swipe_card_secure(character varying, character varying, character varying, character varying) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.swipe_card_secure(character varying, character varying, character varying, character varying) TO authenticated;
