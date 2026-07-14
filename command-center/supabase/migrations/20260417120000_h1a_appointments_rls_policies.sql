-- H1a: RLS coverage for public.appointments (tenant isolation baseline)
-- Goal: lock appointments to tenant-scoped authenticated access + service_role full access.

begin;

alter table public.appointments enable row level security;

drop policy if exists "Appointments are readable by tenant" on public.appointments;
drop policy if exists "Appointments are insertable by tenant" on public.appointments;
drop policy if exists "Appointments are updatable by tenant" on public.appointments;
drop policy if exists "Appointments are deletable by tenant" on public.appointments;
drop policy if exists "Appointments service role full access" on public.appointments;

create policy "Appointments are readable by tenant"
  on public.appointments
  for select
  to authenticated
  using (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

create policy "Appointments are insertable by tenant"
  on public.appointments
  for insert
  to authenticated
  with check (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

create policy "Appointments are updatable by tenant"
  on public.appointments
  for update
  to authenticated
  using (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  )
  with check (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

create policy "Appointments are deletable by tenant"
  on public.appointments
  for delete
  to authenticated
  using (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

create policy "Appointments service role full access"
  on public.appointments
  for all
  to service_role
  using (true)
  with check (true);

commit;
