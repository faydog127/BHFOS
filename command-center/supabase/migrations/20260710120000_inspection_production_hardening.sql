begin;

-- Production hardening and customer-report fields for the inspection workflow.
-- This migration is intentionally additive: no existing table or column is renamed or removed.

alter table public.inspections
  add column if not exists service_type text,
  add column if not exists service_address text,
  add column if not exists limitations_notes text,
  add column if not exists customer_acknowledged_at timestamptz,
  add column if not exists customer_acknowledged_name text,
  add column if not exists customer_acknowledged_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists client_request_id uuid;

create unique index if not exists inspections_tenant_client_request_uidx
  on public.inspections (tenant_id, client_request_id)
  where client_request_id is not null;

create or replace function public.inspection_current_tenant_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '');
$$;

create or replace function public.inspection_tenant_access(p_tenant_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.role() = 'service_role'
    or p_tenant_id = public.inspection_current_tenant_id();
$$;

revoke all on function public.inspection_current_tenant_id() from public;
revoke all on function public.inspection_tenant_access(text) from public;
grant execute on function public.inspection_current_tenant_id() to authenticated, service_role;
grant execute on function public.inspection_tenant_access(text) to authenticated, service_role;

-- Parent RLS.
drop policy if exists "Inspections are readable by tenant" on public.inspections;
drop policy if exists "Inspections are insertable by tenant" on public.inspections;
drop policy if exists "Inspections are updatable by tenant" on public.inspections;
drop policy if exists "Inspections are deletable by tenant" on public.inspections;

create policy "Inspections are readable by tenant" on public.inspections
  for select to authenticated
  using (public.inspection_tenant_access(tenant_id));
create policy "Inspections are insertable by tenant" on public.inspections
  for insert to authenticated
  with check (public.inspection_tenant_access(tenant_id));
create policy "Inspections are updatable by tenant" on public.inspections
  for update to authenticated
  using (public.inspection_tenant_access(tenant_id))
  with check (public.inspection_tenant_access(tenant_id));
create policy "Inspections are deletable by tenant" on public.inspections
  for delete to authenticated
  using (public.inspection_tenant_access(tenant_id));

-- Child-table RLS always verifies both the immutable tenant claim and the parent row.
drop policy if exists "Inspection findings readable by tenant" on public.inspection_findings;
drop policy if exists "Inspection findings insertable by tenant" on public.inspection_findings;
drop policy if exists "Inspection findings updatable by tenant" on public.inspection_findings;
drop policy if exists "Inspection findings deletable by tenant" on public.inspection_findings;
create policy "Inspection findings readable by tenant" on public.inspection_findings
  for select to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_findings.inspection_id and i.tenant_id = inspection_findings.tenant_id)
  );
create policy "Inspection findings insertable by tenant" on public.inspection_findings
  for insert to authenticated with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_findings.inspection_id and i.tenant_id = inspection_findings.tenant_id)
  );
create policy "Inspection findings updatable by tenant" on public.inspection_findings
  for update to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_findings.inspection_id and i.tenant_id = inspection_findings.tenant_id)
  ) with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_findings.inspection_id and i.tenant_id = inspection_findings.tenant_id)
  );
create policy "Inspection findings deletable by tenant" on public.inspection_findings
  for delete to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_findings.inspection_id and i.tenant_id = inspection_findings.tenant_id)
  );

drop policy if exists "Inspection recommendations readable by tenant" on public.inspection_recommendations;
drop policy if exists "Inspection recommendations insertable by tenant" on public.inspection_recommendations;
drop policy if exists "Inspection recommendations updatable by tenant" on public.inspection_recommendations;
drop policy if exists "Inspection recommendations deletable by tenant" on public.inspection_recommendations;
create policy "Inspection recommendations readable by tenant" on public.inspection_recommendations
  for select to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_recommendations.inspection_id and i.tenant_id = inspection_recommendations.tenant_id)
  );
create policy "Inspection recommendations insertable by tenant" on public.inspection_recommendations
  for insert to authenticated with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_recommendations.inspection_id and i.tenant_id = inspection_recommendations.tenant_id)
  );
create policy "Inspection recommendations updatable by tenant" on public.inspection_recommendations
  for update to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_recommendations.inspection_id and i.tenant_id = inspection_recommendations.tenant_id)
  ) with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_recommendations.inspection_id and i.tenant_id = inspection_recommendations.tenant_id)
  );
create policy "Inspection recommendations deletable by tenant" on public.inspection_recommendations
  for delete to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_recommendations.inspection_id and i.tenant_id = inspection_recommendations.tenant_id)
  );

drop policy if exists "Inspection photos readable by tenant" on public.inspection_photos;
drop policy if exists "Inspection photos insertable by tenant" on public.inspection_photos;
drop policy if exists "Inspection photos updatable by tenant" on public.inspection_photos;
drop policy if exists "Inspection photos deletable by tenant" on public.inspection_photos;
create policy "Inspection photos readable by tenant" on public.inspection_photos
  for select to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_photos.inspection_id and i.tenant_id = inspection_photos.tenant_id)
  );
create policy "Inspection photos insertable by tenant" on public.inspection_photos
  for insert to authenticated with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_photos.inspection_id and i.tenant_id = inspection_photos.tenant_id)
  );
create policy "Inspection photos updatable by tenant" on public.inspection_photos
  for update to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_photos.inspection_id and i.tenant_id = inspection_photos.tenant_id)
  ) with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_photos.inspection_id and i.tenant_id = inspection_photos.tenant_id)
  );
create policy "Inspection photos deletable by tenant" on public.inspection_photos
  for delete to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_photos.inspection_id and i.tenant_id = inspection_photos.tenant_id)
  );

drop policy if exists "Inspection events readable by tenant" on public.inspection_events;
drop policy if exists "Inspection events insertable by tenant" on public.inspection_events;
create policy "Inspection events readable by tenant" on public.inspection_events
  for select to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_events.inspection_id and i.tenant_id = inspection_events.tenant_id)
  );
create policy "Inspection events insertable by tenant" on public.inspection_events
  for insert to authenticated with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_events.inspection_id and i.tenant_id = inspection_events.tenant_id)
  );

drop policy if exists "Inspection reports readable by tenant" on public.inspection_reports;
drop policy if exists "Inspection reports insertable by tenant" on public.inspection_reports;
drop policy if exists "Inspection reports updatable by tenant" on public.inspection_reports;
create policy "Inspection reports readable by tenant" on public.inspection_reports
  for select to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_reports.inspection_id and i.tenant_id = inspection_reports.tenant_id)
  );
create policy "Inspection reports insertable by tenant" on public.inspection_reports
  for insert to authenticated with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_reports.inspection_id and i.tenant_id = inspection_reports.tenant_id)
  );
create policy "Inspection reports updatable by tenant" on public.inspection_reports
  for update to authenticated using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_reports.inspection_id and i.tenant_id = inspection_reports.tenant_id)
  ) with check (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_reports.inspection_id and i.tenant_id = inspection_reports.tenant_id)
  );

-- Private storage: tenant and inspection ID must both match the object path.
drop policy if exists "Inspection photos readable by tenant" on storage.objects;
drop policy if exists "Inspection photos insertable by tenant" on storage.objects;
drop policy if exists "Inspection photos updatable by tenant" on storage.objects;
drop policy if exists "Inspection photos deletable by tenant" on storage.objects;
create policy "Inspection photos readable by tenant" on storage.objects
  for select to authenticated using (
    bucket_id = 'inspection-photos'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  );
create policy "Inspection photos insertable by tenant" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'inspection-photos'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  );
create policy "Inspection photos updatable by tenant" on storage.objects
  for update to authenticated using (
    bucket_id = 'inspection-photos'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  ) with check (
    bucket_id = 'inspection-photos'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  );
create policy "Inspection photos deletable by tenant" on storage.objects
  for delete to authenticated using (
    bucket_id = 'inspection-photos'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  );

drop policy if exists "Inspection reports readable by tenant" on storage.objects;
drop policy if exists "Inspection reports insertable by tenant" on storage.objects;
drop policy if exists "Inspection reports updatable by tenant" on storage.objects;
drop policy if exists "Inspection reports deletable by tenant" on storage.objects;
create policy "Inspection reports readable by tenant" on storage.objects
  for select to authenticated using (
    bucket_id = 'inspection-reports'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  );
create policy "Inspection reports insertable by tenant" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'inspection-reports'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  );
create policy "Inspection reports updatable by tenant" on storage.objects
  for update to authenticated using (
    bucket_id = 'inspection-reports'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  ) with check (
    bucket_id = 'inspection-reports'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  );
create policy "Inspection reports deletable by tenant" on storage.objects
  for delete to authenticated using (
    bucket_id = 'inspection-reports'
    and public.inspection_tenant_access((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = 'inspections'
    and exists (
      select 1 from public.inspections i
      where i.tenant_id = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[3]
    )
  );

-- Preserve the existing audited workflows, but put an invoker-rights tenant gate in front of them.
alter function public.inspection_submit(text, uuid, integer, jsonb) rename to inspection_submit_unchecked;
alter function public.inspection_reopen(text, uuid, integer, text) rename to inspection_reopen_unchecked;
alter function public.inspection_complete(text, uuid, integer, jsonb) rename to inspection_complete_unchecked;
alter function public.inspection_void_photo(text, uuid, text) rename to inspection_void_photo_unchecked;

revoke all on function public.inspection_submit_unchecked(text, uuid, integer, jsonb) from public, authenticated;
revoke all on function public.inspection_reopen_unchecked(text, uuid, integer, text) from public, authenticated;
revoke all on function public.inspection_complete_unchecked(text, uuid, integer, jsonb) from public, authenticated;
revoke all on function public.inspection_void_photo_unchecked(text, uuid, text) from public, authenticated;

create function public.inspection_submit(
  p_tenant_id text, p_inspection_id uuid, p_expected_revision integer,
  p_validation_snapshot jsonb default '{}'::jsonb
)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.inspection_tenant_access(p_tenant_id) then
    raise exception using errcode = '42501', message = 'tenant_mismatch';
  end if;
  return public.inspection_submit_unchecked(p_tenant_id, p_inspection_id, p_expected_revision, p_validation_snapshot);
end;
$$;

create function public.inspection_reopen(
  p_tenant_id text, p_inspection_id uuid, p_expected_revision integer, p_reason text
)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.inspection_tenant_access(p_tenant_id) then
    raise exception using errcode = '42501', message = 'tenant_mismatch';
  end if;
  return public.inspection_reopen_unchecked(p_tenant_id, p_inspection_id, p_expected_revision, p_reason);
end;
$$;

create function public.inspection_complete(
  p_tenant_id text, p_inspection_id uuid, p_expected_revision integer,
  p_qa_snapshot jsonb default '{}'::jsonb
)
returns public.inspections
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.inspection_tenant_access(p_tenant_id) then
    raise exception using errcode = '42501', message = 'tenant_mismatch';
  end if;
  return public.inspection_complete_unchecked(p_tenant_id, p_inspection_id, p_expected_revision, p_qa_snapshot);
end;
$$;

create function public.inspection_void_photo(p_tenant_id text, p_photo_id uuid, p_reason text)
returns public.inspection_photos
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.inspection_tenant_access(p_tenant_id) then
    raise exception using errcode = '42501', message = 'tenant_mismatch';
  end if;
  return public.inspection_void_photo_unchecked(p_tenant_id, p_photo_id, p_reason);
end;
$$;

grant execute on function public.inspection_submit(text, uuid, integer, jsonb) to authenticated, service_role;
grant execute on function public.inspection_reopen(text, uuid, integer, text) to authenticated, service_role;
grant execute on function public.inspection_complete(text, uuid, integer, jsonb) to authenticated, service_role;
grant execute on function public.inspection_void_photo(text, uuid, text) to authenticated, service_role;

commit;
