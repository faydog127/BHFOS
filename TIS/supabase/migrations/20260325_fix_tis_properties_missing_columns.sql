alter table if exists public.tis_properties
  add column if not exists lead_status text,
  add column if not exists lead_contacted_at timestamptz;
