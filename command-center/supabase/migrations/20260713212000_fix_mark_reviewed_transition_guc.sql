-- Fix: inspection_mark_reviewed must set app.inspection_transition before
-- updating a submitted/completed inspection. Without it, Finalize after
-- Submit fails with "Inspection is locked. Reopen to edit." (tech UI path).

begin;

create or replace function public.inspection_mark_reviewed(p_tenant_id text, p_inspection_id uuid, p_expected_revision integer)
returns public.inspections language plpgsql security definer set search_path = public, auth as $$
declare
  v_row public.inspections;
  v_user uuid := auth.uid();
  v_issues jsonb;
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  select * into v_row from public.inspections where id = p_inspection_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'inspection_not_found'; end if;
  if v_row.revision <> p_expected_revision then raise exception 'stale_revision'; end if;
  if exists (
    select 1
    from public.inspection_ai_suggestions s
    join public.inspection_photos p on p.id = s.photo_id and p.tenant_id = s.tenant_id
    where s.tenant_id = p_tenant_id
      and s.inspection_id = p_inspection_id
      and s.inspection_revision = p_expected_revision
      and s.status = 'pending'
      and coalesce(p.is_voided, false) = false
  ) then
    raise exception 'pending_ai_suggestions';
  end if;
  v_issues := public.inspection_report_coherence_issues(p_tenant_id, p_inspection_id);
  if jsonb_array_length(v_issues) > 0 then
    raise exception using errcode = 'P0001', message = 'report_coherence_failed', detail = v_issues::text;
  end if;

  -- Required for updates while status is submitted/completed.
  perform set_config('app.inspection_transition', '1', true);

  update public.inspections set reviewed_at = now(), reviewed_by_user_id = v_user, reviewed_revision = revision
  where id = p_inspection_id returning * into v_row;
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, p_inspection_id, 'report_reviewed', v_user, p_expected_revision,
    jsonb_build_object('ai_is_advisory', true, 'coherence_gate', 'passed'));
  return v_row;
end;
$$;

grant execute on function public.inspection_mark_reviewed(text, uuid, integer) to authenticated, service_role;

commit;
