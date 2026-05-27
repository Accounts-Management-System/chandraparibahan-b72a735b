
-- Vehicles
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_no text NOT NULL,
  owner_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all vehicles" ON public.vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Contact types
CREATE TYPE public.contact_type AS ENUM (
  'individual','company','rental','vendor','owner','helper','partner',
  'dada_bhai','mejho_bhai','choto_bhai','bordidi','mejhdidi'
);

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.contact_type NOT NULL,
  phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trips / Daily Accounts
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date date NOT NULL DEFAULT current_date,
  vehicle_no text NOT NULL,
  jama_1 numeric NOT NULL DEFAULT 0,
  jama_2 numeric NOT NULL DEFAULT 0,
  dena_1 numeric NOT NULL DEFAULT 0,
  dena_2 numeric NOT NULL DEFAULT 0,
  fare_1 numeric NOT NULL DEFAULT 0,
  fare_2 numeric NOT NULL DEFAULT 0,
  supervisor text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all trips" ON public.trips FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX trips_date_idx ON public.trips (trip_date);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  description text,
  vehicle_no text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX expenses_date_idx ON public.expenses (expense_date);

-- Other incomes
CREATE TABLE public.other_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  income_date date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  description text,
  vehicle_no text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.other_incomes TO authenticated;
GRANT ALL ON public.other_incomes TO service_role;
ALTER TABLE public.other_incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all other_incomes" ON public.other_incomes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX other_incomes_date_idx ON public.other_incomes (income_date);

-- Transfers
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_date date NOT NULL DEFAULT current_date,
  from_party text NOT NULL,
  to_party text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
GRANT ALL ON public.transfers TO service_role;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all transfers" ON public.transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX transfers_date_idx ON public.transfers (transfer_date);
