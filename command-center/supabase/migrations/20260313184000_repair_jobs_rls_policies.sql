-- Repair jobs RLS so authenticated tenant users can update work orders.
-- This addresses silent zero-row updates from the scheduling UI.

begin;

alter table public.jobs enable row level security;

drop policy if exists "Auth read jobs" on public.jobs;
drop policy if exists "Jobs are readable by tenant" on public.jobs;
drop policy if exists "Jobs are insertable by tenant" on public.jobs;
drop policy if exists "Jobs are updatable by tenant" on public.jobs;
drop policy if exists "Jobs are deletable by tenant" on public.jobs;
drop policy if exists "Jobs service role full access" on public.jobs;

create policy "Jobs are readable by tenant"
  on public.jobs
  for select
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Jobs are insertable by tenant"
  on public.jobs
  for insert
  to authenticated
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Jobs are updatable by tenant"
  on public.jobs
  for update
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  )
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Jobs are deletable by tenant"
  on public.jobs
  for delete
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Jobs service role full access"
  on public.jobs
  for all
  to service_role
  using (true)
  with check (true);

commit;
