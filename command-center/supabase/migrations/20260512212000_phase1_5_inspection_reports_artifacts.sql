begin;

-- Phase 1.5: Immutable report artifacts + version tracking.
-- Reports are stored as immutable files (never overwritten) in a private bucket.

create extension if not exists pgcrypto;

-- ----------------------------------------
-- 0) Storage bucket for inspection reports
-- ----------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('inspection-reports', 'inspection-reports', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- Storage policies: first folder segment must match tenant_id claim.
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  drop policy if exists "Inspection reports readable by tenant" on storage.objects;
  drop policy if exists "Inspection reports insertable by tenant" on storage.objects;
  drop policy if exists "Inspection reports updatable by tenant" on storage.objects;
  drop policy if exists "Inspection reports deletable by tenant" on storage.objects;
  drop policy if exists "Inspection reports service role full access" on storage.objects;

  create policy "Inspection reports readable by tenant"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'inspection-reports'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    );

  create policy "Inspection reports insertable by tenant"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'inspection-reports'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    );

  create policy "Inspection reports updatable by tenant"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'inspection-reports'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    )
    with check (
      bucket_id = 'inspection-reports'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    );

  create policy "Inspection reports deletable by tenant"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'inspection-reports'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    );

  create policy "Inspection reports service role full access"
    on storage.objects
    for all
    to service_role
    using (true)
    with check (true);
end $$;

-- ----------------------------------------
-- 1) Report artifacts table
-- ----------------------------------------
create table if not exists public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  inspection_revision integer not null,
  report_version integer not null,
  status text not null default 'generated', -- draft | generated | sent | superseded | voided
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  sent_method text,
  sent_to text,
  file_path text not null,
  file_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_reports_version_unique unique (tenant_id, inspection_id, inspection_revision, report_version)
);

create index if not exists inspection_reports_tenant_inspection_idx
  on public.inspection_reports (tenant_id, inspection_id, generated_at desc);
create index if not exists inspection_reports_tenant_status_idx
  on public.inspection_reports (tenant_id, status, generated_at desc);

alter table public.inspection_reports enable row level security;

drop policy if exists "Inspection reports readable by tenant" on public.inspection_reports;
drop policy if exists "Inspection reports insertable by tenant" on public.inspection_reports;
drop policy if exists "Inspection reports updatable by tenant" on public.inspection_reports;
drop policy if exists "Inspection reports service role full access" on public.inspection_reports;

create policy "Inspection reports readable by tenant"
  on public.inspection_reports
  for select
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.inspections i
      where i.id = inspection_reports.inspection_id
        and i.tenant_id = inspection_reports.tenant_id
    )
  );

create policy "Inspection reports insertable by tenant"
  on public.inspection_reports
  for insert
  to authenticated
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.inspections i
      where i.id = inspection_reports.inspection_id
        and i.tenant_id = inspection_reports.tenant_id
    )
  );

create policy "Inspection reports updatable by tenant"
  on public.inspection_reports
  for update
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.inspections i
      where i.id = inspection_reports.inspection_id
        and i.tenant_id = inspection_reports.tenant_id
    )
  )
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.inspections i
      where i.id = inspection_reports.inspection_id
        and i.tenant_id = inspection_reports.tenant_id
    )
  );

create policy "Inspection reports service role full access"
  on public.inspection_reports
  for all
  to service_role
  using (true)
  with check (true);

-- Enforce status vocabulary.
alter table public.inspection_reports
  drop constraint if exists inspection_reports_status_vocabulary_chk;

alter table public.inspection_reports
  add constraint inspection_reports_status_vocabulary_chk
  check (lower(status) in ('draft', 'generated', 'sent', 'superseded', 'voided'));

commit;

