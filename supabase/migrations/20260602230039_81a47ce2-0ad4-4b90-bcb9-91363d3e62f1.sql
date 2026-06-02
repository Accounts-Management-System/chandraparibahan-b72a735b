DROP TRIGGER IF EXISTS trg_assign_trip_serial ON public.trips;
CREATE TRIGGER trg_assign_trip_serial
BEFORE INSERT ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.assign_trip_serial();

-- Backfill: assign per-day serial to existing rows missing serial_no
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY trip_date ORDER BY created_at, id) AS rn
  FROM public.trips
)
UPDATE public.trips t
SET serial_no = r.rn
FROM ranked r
WHERE t.id = r.id AND (t.serial_no IS NULL OR t.serial_no = 0);