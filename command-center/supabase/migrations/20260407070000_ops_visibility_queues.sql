-- Ops Visibility queue tables required by UI (`/crm/ops`).
-- Creates:
--  - public.event_jobs
--  - public.messages
-- Tenant-scoped with optional superuser read/update for global Ops view.

create extension if not exists pgcrypto;
create table if not exists public.event_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  type text not null,
  status text not null default 'queued',
  idempotency_key text,
  payload jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_jobs_attempts_range check (attempts >= 0),
  constraint event_jobs_max_attempts_range check (max_attempts >= 0)
);
create index if not exists event_jobs_tenant_id_idx on public.event_jobs (tenant_id);
create index if not exists event_jobs_tenant_status_idx on public.event_jobs (tenant_id, status);
create index if not exists event_jobs_run_at_idx on public.event_jobs (run_at);
alter table public.event_jobs enable row level security;
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  channel text not null default 'email',
  recipient text,
  status text not null default 'queued',
  idempotency_key text,
  payload jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  scheduled_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_attempts_range check (attempts >= 0),
  constraint messages_max_attempts_range check (max_attempts >= 0)
);
create index if not exists messages_tenant_id_idx on public.messages (tenant_id);
create index if not exists messages_tenant_status_idx on public.messages (tenant_id, status);
create index if not exists messages_scheduled_at_idx on public.messages (scheduled_at);
alter table public.messages enable row level security;
-- RLS helpers
-- Tenant id can live in app_metadata or user_metadata.
-- Superuser flag is optional; if present it enables global ops visibility.
create or replace function public._auth_tenant_id()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'tenant_id',
    auth.jwt() -> 'user_metadata' ->> 'tenant_id'
  );
$$;
create or replace function public._auth_is_superuser()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_superuser')::boolean,
    (auth.jwt() -> 'user_metadata' ->> 'is_superuser')::boolean,
    false
  );
$$;
-- event_jobs policies
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_jobs' and policyname='event_jobs select'
  ) then
    create policy "event_jobs select"
      on public.event_jobs
      for select
      to authenticated
      using (tenant_id = public._auth_tenant_id() or public._auth_is_superuser());
  end if;
end$$;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_jobs' and policyname='event_jobs update'
  ) then
    create policy "event_jobs update"
      on public.event_jobs
      for update
      to authenticated
      using (tenant_id = public._auth_tenant_id() or public._auth_is_superuser())
      with check (tenant_id = public._auth_tenant_id() or public._auth_is_superuser());
  end if;
end$$;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_jobs' and policyname='event_jobs service_role'
  ) then
    create policy "event_jobs service_role"
      on public.event_jobs
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end$$;
-- messages policies
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages select'
  ) then
    create policy "messages select"
      on public.messages
      for select
      to authenticated
      using (tenant_id = public._auth_tenant_id() or public._auth_is_superuser());
  end if;
end$$;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages update'
  ) then
    create policy "messages update"
      on public.messages
      for update
      to authenticated
      using (tenant_id = public._auth_tenant_id() or public._auth_is_superuser())
      with check (tenant_id = public._auth_tenant_id() or public._auth_is_superuser());
  end if;
end$$;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages service_role'
  ) then
    create policy "messages service_role"
      on public.messages
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end$$;
