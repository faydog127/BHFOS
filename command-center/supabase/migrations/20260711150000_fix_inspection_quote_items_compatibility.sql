begin;

alter table public.quote_items
  add column if not exists updated_at timestamptz not null default now();

commit;
