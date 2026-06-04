DROP POLICY IF EXISTS "auth insert vendor_receivables" ON public.vendor_receivables;
DROP POLICY IF EXISTS "auth update vendor_receivables" ON public.vendor_receivables;
DROP POLICY IF EXISTS "auth delete vendor_receivables" ON public.vendor_receivables;

CREATE POLICY "mods insert vendor_receivables" ON public.vendor_receivables
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_moderator(auth.uid()));

CREATE POLICY "mods update vendor_receivables" ON public.vendor_receivables
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()))
  WITH CHECK (public.is_admin_or_moderator(auth.uid()));

CREATE POLICY "mods delete vendor_receivables" ON public.vendor_receivables
  FOR DELETE TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()));