-- Bridge migration for environments where quote_items/invoice_items
-- do not have created_at, but 20260215_01 orders backfill by created_at.

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.quote_items
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.quote_items
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.invoice_items
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.invoice_items
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;
