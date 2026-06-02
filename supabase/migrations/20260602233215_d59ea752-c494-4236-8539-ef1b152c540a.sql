ALTER TABLE public.other_incomes ADD COLUMN IF NOT EXISTS vendor text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor text;
CREATE INDEX IF NOT EXISTS idx_other_incomes_vendor ON public.other_incomes(vendor);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON public.expenses(vendor);