
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS head text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.other_incomes ADD COLUMN IF NOT EXISTS head text;
ALTER TABLE public.other_incomes ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS public.entry_lookups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('category','head','description')),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entry_lookups TO authenticated;
GRANT ALL ON public.entry_lookups TO service_role;

ALTER TABLE public.entry_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all entry_lookups" ON public.entry_lookups FOR ALL TO authenticated USING (true) WITH CHECK (true);
