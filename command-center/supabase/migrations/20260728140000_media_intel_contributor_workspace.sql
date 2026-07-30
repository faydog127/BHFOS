-- Contributor Workspace (product name) — extends Creator/reel_creator architecture.
-- Internal identifiers retain reel_creator / mil_creator_* to avoid authz risk.
-- Hardens assignment eligibility for archived/trashed media; adds assignment brief fields + pause.

begin;

-- ---------------------------------------------------------------------------
-- 1. Assignment status: pause support + brief columns
-- ---------------------------------------------------------------------------
alter table public.mil_creator_assignments
  drop constraint if exists mil_creator_assignments_status_check;

alter table public.mil_creator_assignments
  add constraint mil_creator_assignments_status_check
  check (status in ('active', 'paused', 'revoked', 'completed'));

alter table public.mil_creator_assignments
  add column if not exists due_at timestamptz,
  add column if not exists requested_output text,
  add column if not exists platform_format text,
  add column if not exists instructions text;

comment on column public.mil_creator_assignments.instructions is
  'Owner brief for the contributor assignment (product: Contributor Workspace).';
comment on column public.mil_creator_assignments.due_at is
  'Optional due date for the assignment.';
comment on column public.mil_creator_assignments.requested_output is
  'Requested deliverable type (e.g. reel, before_after_clip, still_set).';
comment on column public.mil_creator_assignments.platform_format is
  'Optional platform/format details (e.g. Instagram Reels 9:16).';
comment on column public.mil_creator_assignments.status is
  'active | paused | revoked | completed. Only active authorizes media access.';

update public.mil_creator_assignments
set instructions = notes
where instructions is null
  and notes is not null
  and btrim(notes) <> '';

-- ---------------------------------------------------------------------------
-- 2. Replace mil_assign_creator — deny archived/trashed; accept brief fields
-- ---------------------------------------------------------------------------
drop function if exists public.mil_assign_creator(uuid, uuid, uuid, text);

create or replace function public.mil_assign_creator(
  p_creator_user_id uuid,
  p_asset_id uuid,
  p_collection_id uuid,
  p_notes text default null,
  p_due_at timestamptz default null,
  p_requested_output text default null,
  p_platform_format text default null,
  p_instructions text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_asset public.mil_assets%rowtype;
  v_instructions text := nullif(trim(coalesce(p_instructions, p_notes, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may assign creators';
  end if;
  if (p_asset_id is null) = (p_collection_id is null) then
    raise exception 'Exactly one of asset_id or collection_id must be provided';
  end if;

  if not exists (
    select 1 from public.app_user_roles r
    where r.user_id = p_creator_user_id
      and public.mil_normalize_role(r.role) = 'reel_creator'
  ) then
    raise exception 'Assignee must have reel_creator (Contributor) role';
  end if;

  if p_asset_id is not null then
    select * into v_asset from public.mil_assets where id = p_asset_id;
    if not found then
      raise exception 'Asset not found';
    end if;
    if v_asset.archived_at is not null then
      raise exception 'Cannot assign archived media to a contributor';
    end if;
    if v_asset.trashed_at is not null then
      raise exception 'Cannot assign trashed media to a contributor';
    end if;
  end if;

  if p_collection_id is not null then
    if exists (
      select 1
      from public.mil_collection_items ci
      join public.mil_assets a on a.id = ci.asset_id
      where ci.collection_id = p_collection_id
        and (a.archived_at is not null or a.trashed_at is not null)
    ) then
      raise exception 'Collection contains archived or trashed media and cannot be assigned';
    end if;
  end if;

  insert into public.mil_creator_assignments (
    asset_id,
    collection_id,
    creator_user_id,
    assigned_by,
    status,
    notes,
    instructions,
    due_at,
    requested_output,
    platform_format
  )
  values (
    p_asset_id,
    p_collection_id,
    p_creator_user_id,
    auth.uid(),
    'active',
    p_notes,
    v_instructions,
    p_due_at,
    nullif(trim(coalesce(p_requested_output, '')), ''),
    nullif(trim(coalesce(p_platform_format, '')), '')
  )
  returning id into v_id;

  perform public.mil_audit_insert(
    'creator_assigned',
    'mil_creator_assignments',
    v_id,
    jsonb_build_object(
      'creator_user_id', p_creator_user_id,
      'asset_id', p_asset_id,
      'collection_id', p_collection_id,
      'notes', p_notes,
      'instructions', v_instructions,
      'due_at', p_due_at,
      'requested_output', p_requested_output,
      'platform_format', p_platform_format
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Pause / resume / complete assignment
-- ---------------------------------------------------------------------------
create or replace function public.mil_set_creator_assignment_status(
  p_assignment_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mil_creator_assignments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may change assignment status';
  end if;
  if p_status not in ('active', 'paused', 'completed') then
    raise exception 'Invalid assignment status';
  end if;

  select * into v_row
  from public.mil_creator_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'Assignment not found';
  end if;
  if v_row.status = 'revoked' then
    raise exception 'Revoked assignments cannot be reactivated here; create a new assignment';
  end if;

  update public.mil_creator_assignments
  set status = p_status
  where id = p_assignment_id;

  perform public.mil_audit_insert(
    'creator_assignment_status',
    'mil_creator_assignments',
    p_assignment_id,
    jsonb_build_object('from', v_row.status, 'to', p_status)
  );

  return true;
end;
$$;

revoke all on function public.mil_assign_creator(uuid, uuid, uuid, text, timestamptz, text, text, text) from public;
revoke all on function public.mil_set_creator_assignment_status(uuid, text) from public;
grant execute on function public.mil_assign_creator(uuid, uuid, uuid, text, timestamptz, text, text, text) to authenticated;
grant execute on function public.mil_set_creator_assignment_status(uuid, text) to authenticated;

commit;
