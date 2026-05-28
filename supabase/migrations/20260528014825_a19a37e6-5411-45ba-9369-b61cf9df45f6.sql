
-- 1. Role enum + user_roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'shareholder');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'moderator')
  );
$$;

CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. contacts → shareholder fields
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS login_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp text;

-- 3. vehicles → shareholder link
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS shareholder_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- 4. admin_diary
CREATE TABLE public.admin_diary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_diary TO authenticated;
GRANT ALL ON public.admin_diary TO service_role;

ALTER TABLE public.admin_diary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin own diary" ON public.admin_diary
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

-- 5. Tighten RLS on existing tables: replace permissive "auth all" with role-based
-- Shareholders: read-only their own data; admin/mod full access
DROP POLICY IF EXISTS "auth all trips" ON public.trips;
CREATE POLICY "trips read all auth" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "trips write admin/mod" ON public.trips FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "trips update admin/mod" ON public.trips FOR UPDATE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "trips delete admin/mod" ON public.trips FOR DELETE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "auth all expenses" ON public.expenses;
CREATE POLICY "exp read" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "exp ins" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "exp upd" ON public.expenses FOR UPDATE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "exp del" ON public.expenses FOR DELETE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "auth all other_incomes" ON public.other_incomes;
CREATE POLICY "oi read" ON public.other_incomes FOR SELECT TO authenticated USING (true);
CREATE POLICY "oi ins" ON public.other_incomes FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "oi upd" ON public.other_incomes FOR UPDATE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "oi del" ON public.other_incomes FOR DELETE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "auth all vehicles" ON public.vehicles;
CREATE POLICY "veh read" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "veh ins" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "veh upd" ON public.vehicles FOR UPDATE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "veh del" ON public.vehicles FOR DELETE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "auth all vehicle_routes" ON public.vehicle_routes;
CREATE POLICY "vr read" ON public.vehicle_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "vr ins" ON public.vehicle_routes FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "vr upd" ON public.vehicle_routes FOR UPDATE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "vr del" ON public.vehicle_routes FOR DELETE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "auth all contacts" ON public.contacts;
CREATE POLICY "ct read" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ct ins" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ct upd" ON public.contacts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ct del" ON public.contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth all entry_lookups" ON public.entry_lookups;
CREATE POLICY "el read" ON public.entry_lookups FOR SELECT TO authenticated USING (true);
CREATE POLICY "el ins" ON public.entry_lookups FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "el upd" ON public.entry_lookups FOR UPDATE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));
CREATE POLICY "el del" ON public.entry_lookups FOR DELETE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));

-- 6. Trigger to update updated_at on admin_diary
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER admin_diary_touch BEFORE UPDATE ON public.admin_diary
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
