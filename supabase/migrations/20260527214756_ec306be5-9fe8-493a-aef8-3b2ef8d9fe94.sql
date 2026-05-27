
-- 1. vehicle_routes table
CREATE TABLE public.vehicle_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  name text NOT NULL,
  fare numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_routes TO authenticated;
GRANT ALL ON public.vehicle_routes TO service_role;

ALTER TABLE public.vehicle_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all vehicle_routes" ON public.vehicle_routes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_vehicle_routes_vehicle_id ON public.vehicle_routes(vehicle_id);

-- 2. trips: add route_1, route_2, serial_no; drop notes
ALTER TABLE public.trips ADD COLUMN route_1 text;
ALTER TABLE public.trips ADD COLUMN route_2 text;
ALTER TABLE public.trips ADD COLUMN serial_no integer;
ALTER TABLE public.trips DROP COLUMN IF EXISTS notes;

CREATE INDEX idx_trips_date_serial ON public.trips(trip_date, serial_no);

-- 3. drop notes from other tables
ALTER TABLE public.expenses DROP COLUMN IF EXISTS description;
ALTER TABLE public.other_incomes DROP COLUMN IF EXISTS description;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS notes;

-- 4. drop transfers
DROP TABLE IF EXISTS public.transfers;

-- 5. auto-serial trigger per date
CREATE OR REPLACE FUNCTION public.assign_trip_serial()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.serial_no IS NULL THEN
    SELECT COALESCE(MAX(serial_no), 0) + 1
      INTO NEW.serial_no
      FROM public.trips
      WHERE trip_date = NEW.trip_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trips_assign_serial
  BEFORE INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_trip_serial();
