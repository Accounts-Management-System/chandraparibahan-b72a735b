ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS login_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;