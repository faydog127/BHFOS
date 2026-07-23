-- Align price_book uniqueness with production (UNIQUE on code).
-- Prod already has price_book_code_key; greenfield DBs only had UNIQUE(tenant_id, code).
-- Idempotent: add code unique if missing. Keep tenant+code unique if present.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.price_book'::regclass
      AND conname = 'price_book_code_key'
  ) THEN
    ALTER TABLE public.price_book
      ADD CONSTRAINT price_book_code_key UNIQUE (code);
  END IF;
END $$;
