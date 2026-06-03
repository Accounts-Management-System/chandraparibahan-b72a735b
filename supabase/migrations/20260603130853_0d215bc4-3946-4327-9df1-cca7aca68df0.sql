
DROP POLICY IF EXISTS "ct read" ON public.contacts;
CREATE POLICY "ct read" ON public.contacts FOR SELECT TO authenticated
USING (is_admin_or_moderator(auth.uid()) OR auth_user_id = auth.uid());

DROP POLICY IF EXISTS "own read" ON public.owners;
CREATE POLICY "own read" ON public.owners FOR SELECT TO authenticated
USING (is_admin_or_moderator(auth.uid()) OR auth_user_id = auth.uid());
