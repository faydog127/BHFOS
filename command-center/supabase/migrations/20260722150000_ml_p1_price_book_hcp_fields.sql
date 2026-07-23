-- PD-PB-04: smallest safe HCP catalog fields on public.price_book
-- Additive only. No price changes. No multi-company / tenant architecture.

ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS taxable boolean;

ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS online_booking_enabled boolean;

ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS subcategory text;

ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS industry text;

ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS unit_of_measure text;

COMMENT ON COLUMN public.price_book.taxable IS 'HCP taxable flag; nullable for legacy rows';
COMMENT ON COLUMN public.price_book.online_booking_enabled IS 'HCP online booking flag; nullable for legacy rows';
COMMENT ON COLUMN public.price_book.subcategory IS 'HCP subcategory_1 (optionally with subcategory_2 appended)';
COMMENT ON COLUMN public.price_book.industry IS 'HCP industry label';
COMMENT ON COLUMN public.price_book.unit_of_measure IS 'HCP unit_of_measure (each/system/visit/etc)';
