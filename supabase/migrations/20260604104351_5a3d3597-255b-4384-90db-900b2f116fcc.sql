CREATE TABLE public.vendor_receivables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor TEXT NOT NULL,
  owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_receivables TO authenticated;
GRANT ALL ON public.vendor_receivables TO service_role;

ALTER TABLE public.vendor_receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read vendor_receivables" ON public.vendor_receivables FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert vendor_receivables" ON public.vendor_receivables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update vendor_receivables" ON public.vendor_receivables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete vendor_receivables" ON public.vendor_receivables FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_vendor_receivables_updated_at BEFORE UPDATE ON public.vendor_receivables FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_vendor_receivables_vendor ON public.vendor_receivables (vendor);
CREATE INDEX idx_vendor_receivables_owner ON public.vendor_receivables (owner_id);
CREATE INDEX idx_vendor_receivables_date ON public.vendor_receivables (entry_date);