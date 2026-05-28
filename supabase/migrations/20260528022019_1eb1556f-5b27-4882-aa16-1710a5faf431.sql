CREATE OR REPLACE FUNCTION public.bootstrap_admin_if_no_roles(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO role_count FROM public.user_roles;

  IF role_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN true;
  END IF;

  RETURN public.has_role(_user_id, 'admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_admin_if_no_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin_if_no_roles(uuid) TO service_role;