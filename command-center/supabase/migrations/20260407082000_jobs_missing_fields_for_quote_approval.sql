begin;
-- Ops/Work-order invariants expect these columns to exist on `public.jobs`.
-- Some environments already have `public.jobs` from earlier eras without these fields,
-- and `create table if not exists` migrations will not add them retroactively.

alter table public.jobs
  add column if not exists estimate_id uuid,
  add column if not exists amount_paid numeric,
  add column if not exists payment_method text;
commit;
