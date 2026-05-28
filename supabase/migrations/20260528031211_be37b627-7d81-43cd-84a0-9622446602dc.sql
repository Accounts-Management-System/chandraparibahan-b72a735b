
-- Owners
CREATE TABLE public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read" ON public.owners FOR SELECT TO authenticated USING (true);
CREATE POLICY "own ins" ON public.owners FOR INSERT TO authenticated WITH CHECK (is_admin_or_moderator(auth.uid()));
CREATE POLICY "own upd" ON public.owners FOR UPDATE TO authenticated USING (is_admin_or_moderator(auth.uid()));
CREATE POLICY "own del" ON public.owners FOR DELETE TO authenticated USING (is_admin_or_moderator(auth.uid()));

-- Vehicle owner link
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON public.vehicles(owner_id);

-- Expense Categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec read" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ec ins" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (is_admin_or_moderator(auth.uid()));
CREATE POLICY "ec upd" ON public.expense_categories FOR UPDATE TO authenticated USING (is_admin_or_moderator(auth.uid()));
CREATE POLICY "ec del" ON public.expense_categories FOR DELETE TO authenticated USING (is_admin_or_moderator(auth.uid()));

-- Expense Heads
CREATE TABLE public.expense_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_heads TO authenticated;
GRANT ALL ON public.expense_heads TO service_role;
ALTER TABLE public.expense_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eh read" ON public.expense_heads FOR SELECT TO authenticated USING (true);
CREATE POLICY "eh ins" ON public.expense_heads FOR INSERT TO authenticated WITH CHECK (is_admin_or_moderator(auth.uid()));
CREATE POLICY "eh upd" ON public.expense_heads FOR UPDATE TO authenticated USING (is_admin_or_moderator(auth.uid()));
CREATE POLICY "eh del" ON public.expense_heads FOR DELETE TO authenticated USING (is_admin_or_moderator(auth.uid()));
CREATE INDEX idx_expense_heads_cat ON public.expense_heads(category_id);
