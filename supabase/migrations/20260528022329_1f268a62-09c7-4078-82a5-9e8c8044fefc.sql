REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator(uuid) TO service_role;