begin;

-- Phase 1.5: Completing an inspection (customer-ready) is blocked until uploads resolve.
-- This patches the inspection_complete RPC to enforce the offline contract:
-- - submitted allowed with pending uploads
-- - completed blocked until all non-void photos are upload_state=complete

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
  v_pending_count integer := 0;
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

  -- Block completion until uploads resolve.
  select count(*)
    into v_pending_count
  from public.inspection_photos p
  where p.tenant_id = v_row.tenant_id
    and p.inspection_id = v_row.id
    and coalesce(p.is_voided, false) = false
    and lower(coalesce(p.upload_state, 'complete')) <> 'complete';

  if v_pending_count > 0 then
    raise exception using
      errcode='P0001',
      message = format('Upload unresolved: %s photo(s) still pending/failed.', v_pending_count);
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

commit;

