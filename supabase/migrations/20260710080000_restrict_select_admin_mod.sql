-- Security fix: restrict SELECT on financial/vehicle tables to admins & moderators.
DROP POLICY IF EXISTS "trips read all auth" ON public.trips;
DROP POLICY IF EXISTS "auth all trips" ON public.trips;
CREATE POLICY "trips read admin/mod" ON public.trips
  FOR SELECT TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "exp read" ON public.expenses;
DROP POLICY IF EXISTS "auth all expenses" ON public.expenses;
CREATE POLICY "exp read admin/mod" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "oi read" ON public.other_incomes;
DROP POLICY IF EXISTS "auth all other_incomes" ON public.other_incomes;
CREATE POLICY "oi read admin/mod" ON public.other_incomes
  FOR SELECT TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "veh read" ON public.vehicles;
DROP POLICY IF EXISTS "auth all vehicles" ON public.vehicles;
CREATE POLICY "veh read admin/mod" ON public.vehicles
  FOR SELECT TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "auth read vendor_receivables" ON public.vendor_receivables;
CREATE POLICY "vr read admin/mod" ON public.vendor_receivables
  FOR SELECT TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()));
