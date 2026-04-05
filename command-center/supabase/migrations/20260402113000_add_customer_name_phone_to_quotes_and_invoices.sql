alter table if exists public.quotes
  add column if not exists customer_name text,
  add column if not exists customer_phone text;

alter table if exists public.invoices
  add column if not exists customer_name text,
  add column if not exists customer_phone text;
