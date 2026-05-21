begin;

-- Phase 1.5: Inspection state machine + canonical audit log + evidence integrity.
-- Canonical inspection statuses (DB):
--   draft | submitted | completed
-- "syncing" is UI-only computed state.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Expand inspections table: revision + submit/complete audit
-- ------------------------------------------------------------

alter table public.inspections
  add column if not exists revision integer,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists completed_by_user_id uuid references auth.users(id) on delete set null;

-- Backfill revision.
update public.inspections
set revision = coalesce(revision, 1)
where revision is null;

alter table public.inspections
  alter column revision set default 1;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='inspections'
      and column_name='revision'
      and is_nullable='YES'
  ) then
    alter table public.inspections
      alter column revision set not null;
  end if;
end $$;

-- Normalize legacy inspection statuses into the Phase 1.5 vocabulary.
update public.inspections
set status = 'draft'
where lower(coalesce(status, '')) in ('in_progress', 'open', 'started');

-- Enforce canonical status vocabulary.
alter table public.inspections
  drop constraint if exists inspections_status_vocabulary_chk;

alter table public.inspections
  add constraint inspections_status_vocabulary_chk
  check (lower(status) in ('draft', 'submitted', 'completed'));

-- ------------------------------------------------------------
-- 2) Customer-visible flags (office QA boundary)
-- ------------------------------------------------------------

alter table public.inspection_findings
  add column if not exists is_customer_visible boolean not null default true;

alter table public.inspection_recommendations
  add column if not exists is_customer_visible boolean not null default true;

-- ------------------------------------------------------------
-- 3) Evidence voiding: no hard delete for inspection_photos
-- ------------------------------------------------------------

alter table public.inspection_photos
  add column if not exists is_voided boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists voided_at timestamptz;

-- Forbid persisting blob: URLs (local previews are fine; DB is not).
alter table public.inspection_photos
  drop constraint if exists inspection_photos_object_path_not_blob_chk;

alter table public.inspection_photos
  add constraint inspection_photos_object_path_not_blob_chk
  check (object_path is not null and object_path !~* '^\\s*blob:');

-- ------------------------------------------------------------
-- 4) Canonical operational audit log: inspection_events
-- ------------------------------------------------------------

create table if not exists public.inspection_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_technician_id uuid references public.technicians(id) on delete set null,
  inspection_revision integer,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists inspection_events_tenant_inspection_idx
  on public.inspection_events (tenant_id, inspection_id, event_at desc);
create index if not exists inspection_events_tenant_event_idx
  on public.inspection_events (tenant_id, event_type, event_at desc);

alter table public.inspection_events enable row level security;

drop policy if exists "Inspection events readable by tenant" on public.inspection_events;
drop policy if exists "Inspection events insertable by tenant" on public.inspection_events;
drop policy if exists "Inspection events service role full access" on public.inspection_events;

create policy "Inspection events readable by tenant"
  on public.inspection_events
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
      where i.id = inspection_events.inspection_id
        and i.tenant_id = inspection_events.tenant_id
    )
  );

create policy "Inspection events insertable by tenant"
  on public.inspection_events
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
      where i.id = inspection_events.inspection_id
        and i.tenant_id = inspection_events.tenant_id
    )
  );

create policy "Inspection events service role full access"
  on public.inspection_events
  for all
  to service_role
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- 5) Guards: prevent post-submit silent edits + ban deletes of evidence
-- ------------------------------------------------------------

create or replace function public._is_current_user_technician()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.technicians t
    where t.user_id = auth.uid()
      and coalesce(t.is_active, true) = true
  );
$$;

-- Transition guard: block direct status transitions unless executed by an approved RPC.
-- Approved RPCs set a local GUC: app.inspection_transition = '1'.
create or replace function public.inspections_enforce_state_machine()
returns trigger
language plpgsql
as $$
declare
  allow_transition boolean;
  old_status text;
  new_status text;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  allow_transition := (current_setting('app.inspection_transition', true) = '1');
  old_status := lower(coalesce(old.status, ''));
  new_status := lower(coalesce(new.status, ''));

  -- Block any mutation while submitted/completed unless it's a transition executed via RPC.
  if old_status in ('submitted', 'completed') then
    if not allow_transition then
      raise exception using
        errcode = 'P0001',
        message = 'Inspection is locked. Reopen to edit.';
    end if;
  end if;

  -- Block status transitions unless executed via RPC.
  if new_status <> old_status then
    if not allow_transition then
      raise exception using
        errcode = 'P0001',
        message = 'Inspection status transition must use the server workflow.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inspections_enforce_state_machine on public.inspections;
create trigger trg_inspections_enforce_state_machine
before update
on public.inspections
for each row
execute function public.inspections_enforce_state_machine();

-- Child mutation guard: block changes to findings/recommendations/photos unless inspection is draft.
create or replace function public.inspection_children_require_draft()
returns trigger
language plpgsql
as $$
declare
  parent_status text;
begin
  if auth.role() = 'service_role' then
    return coalesce(new, old);
  end if;

  select lower(coalesce(i.status, 'draft'))
    into parent_status
  from public.inspections i
  where i.id = coalesce(new.inspection_id, old.inspection_id)
    and i.tenant_id = coalesce(new.tenant_id, old.tenant_id);

  if parent_status <> 'draft' then
    raise exception using
      errcode = 'P0001',
      message = 'Inspection is locked. Reopen to edit.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_inspection_findings_require_draft on public.inspection_findings;
create trigger trg_inspection_findings_require_draft
before insert or update or delete
on public.inspection_findings
for each row
execute function public.inspection_children_require_draft();

drop trigger if exists trg_inspection_recommendations_require_draft on public.inspection_recommendations;
create trigger trg_inspection_recommendations_require_draft
before insert or update or delete
on public.inspection_recommendations
for each row
execute function public.inspection_children_require_draft();

drop trigger if exists trg_inspection_photos_require_draft on public.inspection_photos;
create trigger trg_inspection_photos_require_draft
before insert or update or delete
on public.inspection_photos
for each row
execute function public.inspection_children_require_draft();

-- Hard delete ban (defense in depth): inspection_photos can never be deleted.
create or replace function public.inspection_photos_prevent_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'Hard delete is not allowed for inspection photos. Void the evidence instead.';
end;
$$;

drop trigger if exists trg_inspection_photos_prevent_delete on public.inspection_photos;
create trigger trg_inspection_photos_prevent_delete
before delete
on public.inspection_photos
for each row
execute function public.inspection_photos_prevent_delete();

-- ------------------------------------------------------------
-- 6) Automatic "created" event on insert
-- ------------------------------------------------------------
create or replace function public.inspections_log_created_event()
returns trigger
language plpgsql
as $$
begin
  insert into public.inspection_events (
    tenant_id,
    inspection_id,
    event_type,
    actor_user_id,
    actor_technician_id,
    inspection_revision,
    metadata
  ) values (
    new.tenant_id,
    new.id,
    'created',
    auth.uid(),
    (select t.id from public.technicians t where t.user_id = auth.uid() limit 1),
    new.revision,
    jsonb_build_object(
      'status', lower(new.status),
      'source', 'db_trigger'
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_inspections_log_created_event on public.inspections;
create trigger trg_inspections_log_created_event
after insert
on public.inspections
for each row
execute function public.inspections_log_created_event();

-- ------------------------------------------------------------
-- 7) RPC workflows (security definer) for submit/reopen/complete/void
-- ------------------------------------------------------------

create or replace function public.inspection_submit(
  p_tenant_id text,
  p_inspection_id uuid,
  p_expected_revision integer,
  p_validation_snapshot jsonb default '{}'::jsonb
)
returns public.inspections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inspections;
  v_now timestamptz := now();
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'tenant_id is required';
  end if;

  select *
    into v_row
  from public.inspections i
  where i.id = p_inspection_id
    and i.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Inspection not found';
  end if;

  if v_row.revision <> p_expected_revision then
    raise exception using
      errcode = 'P0001',
      message = 'stale_revision';
  end if;

  if lower(v_row.status) <> 'draft' then
    raise exception using
      errcode = 'P0001',
      message = 'Only draft inspections can be submitted.';
  end if;

  perform set_config('app.inspection_transition', '1', true);

  update public.inspections
  set
    status = 'submitted',
    submitted_at = coalesce(submitted_at, v_now),
    submitted_by_user_id = coalesce(submitted_by_user_id, auth.uid()),
    updated_at = v_now
  where id = v_row.id
    and tenant_id = v_row.tenant_id
  returning * into v_row;

  insert into public.inspection_events (
    tenant_id, inspection_id, event_type, event_at,
    actor_user_id, actor_technician_id, inspection_revision, metadata
  ) values (
    v_row.tenant_id, v_row.id, 'submitted', v_now,
    auth.uid(),
    (select t.id from public.technicians t where t.user_id = auth.uid() limit 1),
    v_row.revision,
    coalesce(p_validation_snapshot, '{}'::jsonb)
  );

  return v_row;
end;
$$;

grant execute on function public.inspection_submit(text, uuid, integer, jsonb) to authenticated, service_role;

create or replace function public.inspection_reopen(
  p_tenant_id text,
  p_inspection_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.inspections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inspections;
  v_now timestamptz := now();
  v_is_technician boolean;
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'tenant_id is required';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception using errcode='P0001', message='reopen_reason_required';
  end if;

  select *
    into v_row
  from public.inspections i
  where i.id = p_inspection_id
    and i.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Inspection not found';
  end if;

  if v_row.revision <> p_expected_revision then
    raise exception using errcode='P0001', message='stale_revision';
  end if;

  if lower(v_row.status) = 'draft' then
    return v_row;
  end if;

  v_is_technician := public._is_current_user_technician();

  -- Technician reopen is allowed only if inspection is not completed (office-approved).
  if v_is_technician and lower(v_row.status) = 'completed' then
    raise exception using errcode='P0001', message='Technicians cannot reopen completed inspections.';
  end if;

  perform set_config('app.inspection_transition', '1', true);

  update public.inspections
  set
    status = 'draft',
    revision = revision + 1,
    updated_at = v_now
  where id = v_row.id
    and tenant_id = v_row.tenant_id
  returning * into v_row;

  insert into public.inspection_events (
    tenant_id, inspection_id, event_type, event_at,
    actor_user_id, actor_technician_id, inspection_revision, metadata
  ) values (
    v_row.tenant_id, v_row.id, 'reopened', v_now,
    auth.uid(),
    (select t.id from public.technicians t where t.user_id = auth.uid() limit 1),
    v_row.revision,
    jsonb_build_object('reason', p_reason)
  );

  return v_row;
end;
$$;

grant execute on function public.inspection_reopen(text, uuid, integer, text) to authenticated, service_role;

create or replace function public.inspection_complete(
  p_tenant_id text,
  p_inspection_id uuid,
  p_expected_revision integer,
  p_qa_snapshot jsonb default '{}'::jsonb
)
returns public.inspections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.inspections;
  v_now timestamptz := now();
  v_is_technician boolean;
  v_is_super boolean := false;
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'tenant_id is required';
  end if;

  select *
    into v_row
  from public.inspections i
  where i.id = p_inspection_id
    and i.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Inspection not found';
  end if;

  if v_row.revision <> p_expected_revision then
    raise exception using errcode='P0001', message='stale_revision';
  end if;

  if lower(v_row.status) <> 'submitted' then
    raise exception using errcode='P0001', message='Only submitted inspections can be completed.';
  end if;

  -- Minimal role model:
  -- technicians cannot "complete" (office-approved boundary) unless they are superuser.
  v_is_technician := public._is_current_user_technician();
  begin
    v_is_super := coalesce(public.check_is_superuser(), false);
  exception when undefined_function then
    v_is_super := false;
  end;

  if v_is_technician and not v_is_super then
    raise exception using errcode='P0001', message='Technicians cannot complete inspections. Office review required.';
  end if;

  perform set_config('app.inspection_transition', '1', true);

  update public.inspections
  set
    status = 'completed',
    completed_at = coalesce(completed_at, v_now),
    completed_by_user_id = coalesce(completed_by_user_id, auth.uid()),
    updated_at = v_now
  where id = v_row.id
    and tenant_id = v_row.tenant_id
  returning * into v_row;

  insert into public.inspection_events (
    tenant_id, inspection_id, event_type, event_at,
    actor_user_id, actor_technician_id, inspection_revision, metadata
  ) values (
    v_row.tenant_id, v_row.id, 'completed', v_now,
    auth.uid(),
    (select t.id from public.technicians t where t.user_id = auth.uid() limit 1),
    v_row.revision,
    coalesce(p_qa_snapshot, '{}'::jsonb)
  );

  return v_row;
end;
$$;

grant execute on function public.inspection_complete(text, uuid, integer, jsonb) to authenticated, service_role;

create or replace function public.inspection_void_photo(
  p_tenant_id text,
  p_photo_id uuid,
  p_reason text
)
returns public.inspection_photos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_photo public.inspection_photos;
  v_parent public.inspections;
  v_now timestamptz := now();
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'tenant_id is required';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception using errcode='P0001', message='void_reason_required';
  end if;

  select *
    into v_photo
  from public.inspection_photos p
  where p.id = p_photo_id
    and p.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Photo not found';
  end if;

  select *
    into v_parent
  from public.inspections i
  where i.id = v_photo.inspection_id
    and i.tenant_id = v_photo.tenant_id;

  if not found then
    raise exception 'Parent inspection not found';
  end if;

  if lower(v_parent.status) <> 'draft' then
    raise exception using errcode='P0001', message='Inspection is locked. Reopen to void evidence.';
  end if;

  perform set_config('app.inspection_transition', '1', true);

  update public.inspection_photos
  set
    is_voided = true,
    void_reason = p_reason,
    voided_by = auth.uid(),
    voided_at = v_now,
    updated_at = v_now
  where id = v_photo.id
    and tenant_id = v_photo.tenant_id
  returning * into v_photo;

  insert into public.inspection_events (
    tenant_id, inspection_id, event_type, event_at,
    actor_user_id, actor_technician_id, inspection_revision, metadata
  ) values (
    v_parent.tenant_id, v_parent.id, 'evidence_voided', v_now,
    auth.uid(),
    (select t.id from public.technicians t where t.user_id = auth.uid() limit 1),
    v_parent.revision,
    jsonb_build_object('photo_id', v_photo.id, 'reason', p_reason)
  );

  return v_photo;
end;
$$;

grant execute on function public.inspection_void_photo(text, uuid, text) to authenticated, service_role;

commit;

