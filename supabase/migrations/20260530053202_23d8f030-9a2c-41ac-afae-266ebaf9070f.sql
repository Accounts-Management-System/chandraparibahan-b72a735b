ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL;
ALTER TABLE public.other_incomes ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_owner_id ON public.expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_other_incomes_owner_id ON public.other_incomes(owner_id);