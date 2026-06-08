CREATE TABLE public.office_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_date date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  head text,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_deposits TO authenticated;
GRANT ALL ON public.office_deposits TO service_role;

ALTER TABLE public.office_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_deposits read" ON public.office_deposits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "office_deposits insert admin/mod" ON public.office_deposits
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_moderator(auth.uid()));

CREATE POLICY "office_deposits update admin/mod" ON public.office_deposits
  FOR UPDATE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));

CREATE POLICY "office_deposits delete admin/mod" ON public.office_deposits
  FOR DELETE TO authenticated USING (public.is_admin_or_moderator(auth.uid()));

CREATE INDEX office_deposits_date_idx ON public.office_deposits (deposit_date);

INSERT INTO public.office_deposits (deposit_date, category, head, description, amount, created_at, updated_at)
SELECT income_date, category, head, description, amount, created_at, updated_at
FROM public.other_incomes
WHERE category = 'অফিস কতৃক জমা'
  AND owner_id IS NULL;

DELETE FROM public.other_incomes
WHERE category = 'অফিস কতৃক জমা'
  AND owner_id IS NULL;
