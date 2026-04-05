create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  full_name text not null,
  phone text,
  email text,
  color_code text default '#3b82f6',
  is_active boolean default true,
  is_primary_default boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technicians_active_name_idx
  on public.technicians (is_active, full_name);
