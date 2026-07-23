-- Align price_book identity/timestamp defaults with production.
-- Live already has these; greenfield DBs built only from older migrations did not.

ALTER TABLE public.price_book
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.price_book
  ALTER COLUMN updated_at SET DEFAULT now();
