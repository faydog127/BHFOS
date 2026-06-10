-- Local parity / UI contract:
-- The CRM UI calls `supabase.rpc('check_is_superuser')` (TenantGuard / sidebar / Ops dashboard).
-- PROD already has:
-- - public.superusers (RLS enabled, no policies)
-- - public.check_is_superuser() SECURITY DEFINER
-- Local Supabase bootstraps from `supabase/migrations/` and was missing both,
-- causing PostgREST 404 (PGRST202) for /rest/v1/rpc/check_is_superuser.

create table if not exists public.superusers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure constraints exist even if the table pre-exists (idempotent).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.superusers'::regclass
      and conname = 'superusers_email_key'
  ) then
    alter table public.superusers
      add constraint superusers_email_key unique (email);
  end if;
exception
  when undefined_table then
    -- ignore; table creation above should succeed in normal migration ordering
    null;
end $$;

alter table public.superusers enable row level security;

create or replace function public.check_is_superuser() returns boolean
  language sql
  security definer
as $$
  select exists (
    select 1
    from public.superusers
    where email = (auth.jwt() ->> 'email')
      and is_active = true
  );
$$;

grant execute on function public.check_is_superuser() to anon, authenticated, service_role;

