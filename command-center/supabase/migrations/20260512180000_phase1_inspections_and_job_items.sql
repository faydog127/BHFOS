begin;

-- Phase 1: Inspection-Centered Operations
-- Adds first-class inspection tables + job_items (required by UI/services) + storage bucket/policies for photos.

create extension if not exists pgcrypto;

-- ----------------------------------------
-- 0) Storage bucket for inspection photos
-- ----------------------------------------
-- NOTE: Keep this bucket PRIVATE. Customer-safe PDFs embed images server-side.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('inspection-photos', 'inspection-photos', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- Storage object policies: tenant folder is the first path segment (e.g. tvg/inspections/<inspectionId>/...)
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  -- Clean re-apply for local resets.
  drop policy if exists "Inspection photos readable by tenant" on storage.objects;
  drop policy if exists "Inspection photos insertable by tenant" on storage.objects;
  drop policy if exists "Inspection photos updatable by tenant" on storage.objects;
  drop policy if exists "Inspection photos deletable by tenant" on storage.objects;
  drop policy if exists "Inspection photos service role full access" on storage.objects;

  create policy "Inspection photos readable by tenant"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'inspection-photos'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    );

  create policy "Inspection photos insertable by tenant"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'inspection-photos'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    );

  create policy "Inspection photos updatable by tenant"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'inspection-photos'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    )
    with check (
      bucket_id = 'inspection-photos'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    );

  create policy "Inspection photos deletable by tenant"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'inspection-photos'
      and (storage.foldername(name))[1] = coalesce(
        auth.jwt() -> 'app_metadata' ->> 'tenant_id',
        auth.jwt() -> 'user_metadata' ->> 'tenant_id'
      )
    );

  create policy "Inspection photos service role full access"
    on storage.objects
    for all
    to service_role
    using (true)
    with check (true);
end $$;

-- -----------------------------
-- 1) job_items (fix missing table)
-- -----------------------------
create table if not exists public.job_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  service_id uuid references public.price_book(id) on delete set null,
  service_code text,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  total_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_items_tenant_job_idx on public.job_items (tenant_id, job_id);
create index if not exists job_items_job_idx on public.job_items (job_id);
create index if not exists job_items_tenant_idx on public.job_items (tenant_id);

alter table public.job_items enable row level security;

drop policy if exists "Job items readable by tenant" on public.job_items;
drop policy if exists "Job items insertable by tenant" on public.job_items;
drop policy if exists "Job items updatable by tenant" on public.job_items;
drop policy if exists "Job items deletable by tenant" on public.job_items;
drop policy if exists "Job items service role full access" on public.job_items;

create policy "Job items readable by tenant"
  on public.job_items
  for select
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.jobs j
      where j.id = job_items.job_id
        and j.tenant_id = job_items.tenant_id
    )
  );

create policy "Job items insertable by tenant"
  on public.job_items
  for insert
  to authenticated
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.jobs j
      where j.id = job_items.job_id
        and j.tenant_id = job_items.tenant_id
    )
  );

create policy "Job items updatable by tenant"
  on public.job_items
  for update
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.jobs j
      where j.id = job_items.job_id
        and j.tenant_id = job_items.tenant_id
    )
  )
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.jobs j
      where j.id = job_items.job_id
        and j.tenant_id = job_items.tenant_id
    )
  );

create policy "Job items deletable by tenant"
  on public.job_items
  for delete
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.jobs j
      where j.id = job_items.job_id
        and j.tenant_id = job_items.tenant_id
    )
  );

create policy "Job items service role full access"
  on public.job_items
  for all
  to service_role
  using (true)
  with check (true);

-- ----------------------------------------
-- 2) Inspection tables (first-class model)
-- ----------------------------------------
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  technician_id uuid references public.technicians(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft',
  title text,
  summary text,
  started_at timestamptz,
  completed_at timestamptz,
  disclaimer_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspections_tenant_idx on public.inspections (tenant_id);
create index if not exists inspections_tenant_lead_idx on public.inspections (tenant_id, lead_id);
create index if not exists inspections_tenant_job_idx on public.inspections (tenant_id, job_id);
create index if not exists inspections_tenant_quote_idx on public.inspections (tenant_id, quote_id);
create index if not exists inspections_technician_idx on public.inspections (technician_id);

alter table public.inspections enable row level security;

drop policy if exists "Inspections are readable by tenant" on public.inspections;
drop policy if exists "Inspections are insertable by tenant" on public.inspections;
drop policy if exists "Inspections are updatable by tenant" on public.inspections;
drop policy if exists "Inspections are deletable by tenant" on public.inspections;
drop policy if exists "Inspections service role full access" on public.inspections;

create policy "Inspections are readable by tenant"
  on public.inspections
  for select
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Inspections are insertable by tenant"
  on public.inspections
  for insert
  to authenticated
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Inspections are updatable by tenant"
  on public.inspections
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

create policy "Inspections are deletable by tenant"
  on public.inspections
  for delete
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Inspections service role full access"
  on public.inspections
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  title text not null,
  category text,
  severity text,
  description text,
  recommended_action text,
  sort_order integer not null default 0,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspection_findings_tenant_inspection_idx
  on public.inspection_findings (tenant_id, inspection_id);

alter table public.inspection_findings enable row level security;

drop policy if exists "Inspection findings readable by tenant" on public.inspection_findings;
drop policy if exists "Inspection findings insertable by tenant" on public.inspection_findings;
drop policy if exists "Inspection findings updatable by tenant" on public.inspection_findings;
drop policy if exists "Inspection findings deletable by tenant" on public.inspection_findings;
drop policy if exists "Inspection findings service role full access" on public.inspection_findings;

create policy "Inspection findings readable by tenant"
  on public.inspection_findings
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
      where i.id = inspection_findings.inspection_id
        and i.tenant_id = inspection_findings.tenant_id
    )
  );

create policy "Inspection findings insertable by tenant"
  on public.inspection_findings
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
      where i.id = inspection_findings.inspection_id
        and i.tenant_id = inspection_findings.tenant_id
    )
  );

create policy "Inspection findings updatable by tenant"
  on public.inspection_findings
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
      where i.id = inspection_findings.inspection_id
        and i.tenant_id = inspection_findings.tenant_id
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
      where i.id = inspection_findings.inspection_id
        and i.tenant_id = inspection_findings.tenant_id
    )
  );

create policy "Inspection findings deletable by tenant"
  on public.inspection_findings
  for delete
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.inspections i
      where i.id = inspection_findings.inspection_id
        and i.tenant_id = inspection_findings.tenant_id
    )
  );

create policy "Inspection findings service role full access"
  on public.inspection_findings
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.inspection_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  finding_id uuid references public.inspection_findings(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal',
  suggested_quantity numeric,
  suggested_unit_price numeric,
  status text not null default 'open',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspection_recs_tenant_inspection_idx
  on public.inspection_recommendations (tenant_id, inspection_id);

alter table public.inspection_recommendations enable row level security;

drop policy if exists "Inspection recommendations readable by tenant" on public.inspection_recommendations;
drop policy if exists "Inspection recommendations insertable by tenant" on public.inspection_recommendations;
drop policy if exists "Inspection recommendations updatable by tenant" on public.inspection_recommendations;
drop policy if exists "Inspection recommendations deletable by tenant" on public.inspection_recommendations;
drop policy if exists "Inspection recommendations service role full access" on public.inspection_recommendations;

create policy "Inspection recommendations readable by tenant"
  on public.inspection_recommendations
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
      where i.id = inspection_recommendations.inspection_id
        and i.tenant_id = inspection_recommendations.tenant_id
    )
  );

create policy "Inspection recommendations insertable by tenant"
  on public.inspection_recommendations
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
      where i.id = inspection_recommendations.inspection_id
        and i.tenant_id = inspection_recommendations.tenant_id
    )
  );

create policy "Inspection recommendations updatable by tenant"
  on public.inspection_recommendations
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
      where i.id = inspection_recommendations.inspection_id
        and i.tenant_id = inspection_recommendations.tenant_id
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
      where i.id = inspection_recommendations.inspection_id
        and i.tenant_id = inspection_recommendations.tenant_id
    )
  );

create policy "Inspection recommendations deletable by tenant"
  on public.inspection_recommendations
  for delete
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.inspections i
      where i.id = inspection_recommendations.inspection_id
        and i.tenant_id = inspection_recommendations.tenant_id
    )
  );

create policy "Inspection recommendations service role full access"
  on public.inspection_recommendations
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  finding_id uuid references public.inspection_findings(id) on delete set null,
  recommendation_id uuid references public.inspection_recommendations(id) on delete set null,
  technician_id uuid references public.technicians(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  bucket_id text not null default 'inspection-photos',
  object_path text not null,
  file_name text,
  content_type text,
  byte_size bigint,
  caption text,
  category text,
  is_before boolean,
  taken_at timestamptz,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_photos_bucket_path_unique unique (bucket_id, object_path)
);

create index if not exists inspection_photos_tenant_inspection_idx
  on public.inspection_photos (tenant_id, inspection_id);
create index if not exists inspection_photos_finding_idx
  on public.inspection_photos (finding_id);

alter table public.inspection_photos enable row level security;

drop policy if exists "Inspection photos readable by tenant" on public.inspection_photos;
drop policy if exists "Inspection photos insertable by tenant" on public.inspection_photos;
drop policy if exists "Inspection photos updatable by tenant" on public.inspection_photos;
drop policy if exists "Inspection photos deletable by tenant" on public.inspection_photos;
drop policy if exists "Inspection photos service role full access" on public.inspection_photos;

create policy "Inspection photos readable by tenant"
  on public.inspection_photos
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
      where i.id = inspection_photos.inspection_id
        and i.tenant_id = inspection_photos.tenant_id
    )
  );

create policy "Inspection photos insertable by tenant"
  on public.inspection_photos
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
      where i.id = inspection_photos.inspection_id
        and i.tenant_id = inspection_photos.tenant_id
    )
  );

create policy "Inspection photos updatable by tenant"
  on public.inspection_photos
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
      where i.id = inspection_photos.inspection_id
        and i.tenant_id = inspection_photos.tenant_id
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
      where i.id = inspection_photos.inspection_id
        and i.tenant_id = inspection_photos.tenant_id
    )
  );

create policy "Inspection photos deletable by tenant"
  on public.inspection_photos
  for delete
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
    and exists (
      select 1
      from public.inspections i
      where i.id = inspection_photos.inspection_id
        and i.tenant_id = inspection_photos.tenant_id
    )
  );

create policy "Inspection photos service role full access"
  on public.inspection_photos
  for all
  to service_role
  using (true)
  with check (true);

commit;

