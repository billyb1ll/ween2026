-- =============================================================================
-- Migration: P2 Search Path Fix
-- Date: 2026-07-08
-- Fixes: Restores search_path = public for SECURITY DEFINER functions that
--        were previously set to search_path = '' by the linter, causing 
--        "relation does not exist" errors because internal queries did not 
--        fully qualify their table names.
-- =============================================================================

ALTER FUNCTION public.swipe_card_secure_v2(character varying, character varying, character varying, character varying) SET search_path = public;
ALTER FUNCTION public.admin_reset_vibecheck(character varying, character varying, character varying) SET search_path = public;
ALTER FUNCTION public.admin_set_mission(character varying, character varying, character varying, bigint) SET search_path = public;
ALTER FUNCTION public.admin_delete_mission_reorder(character varying, character varying, bigint) SET search_path = public;
ALTER FUNCTION public.admin_update_user_profile(character varying, character varying, character varying, character varying, character varying, character varying, character varying, character varying) SET search_path = public;
ALTER FUNCTION public.admin_update_system_config(character varying, character varying, character varying, boolean, integer, text) SET search_path = public;
ALTER FUNCTION public.broadcast_emergency_message(uuid, boolean, text) SET search_path = public;
ALTER FUNCTION public.delete_chat_message_secure(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.delete_chat_message_secure(bigint, text, text) SET search_path = public;
ALTER FUNCTION public.delete_comment_secure(bigint, character varying, character varying) SET search_path = public;
ALTER FUNCTION public.delete_post_secure(bigint, character varying, character varying) SET search_path = public;
ALTER FUNCTION public.pin_post_secure(bigint, character varying, character varying, boolean) SET search_path = public;
ALTER FUNCTION public.swipe_card_secure(character varying, character varying, character varying, character varying) SET search_path = public;
