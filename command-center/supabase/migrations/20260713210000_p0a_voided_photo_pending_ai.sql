-- P0a: Voided photos must not leave hidden pending AI decisions that block finalization.
-- Defense in depth: inactivate pending suggestions on void + ignore voided photos in preflight.

begin;

create or replace function public.inspection_void_photo_unchecked(
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
  v_inactivated integer := 0;
  v_affected_finding_ids uuid[] := '{}'::uuid[];
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

  -- Inactivate unresolved AI for this photo only. Preserve rows for audit.
  -- Accepted/edited suggestions stay unchanged.
  with updated as (
    update public.inspection_ai_suggestions s
    set
      status = 'irrelevant',
      reviewed_at = coalesce(s.reviewed_at, v_now),
      reviewed_by_user_id = coalesce(s.reviewed_by_user_id, auth.uid()),
      reviewed_content = coalesce(s.reviewed_content, s.content, '{}'::jsonb)
        || jsonb_build_object(
          'inactive_reason', 'photo_voided',
          'void_reason', p_reason,
          'voided_at', v_now
        )
    where s.tenant_id = p_tenant_id
      and s.photo_id = p_photo_id
      and s.status = 'pending'
    returning s.id
  )
  select count(*)::integer into v_inactivated from updated;

  select coalesce(array_agg(distinct f.id), '{}'::uuid[])
    into v_affected_finding_ids
  from public.inspection_findings f
  where f.tenant_id = p_tenant_id
    and f.inspection_id = v_parent.id
    and exists (
      select 1 from public.inspection_photos p
      where p.tenant_id = f.tenant_id
        and p.inspection_id = f.inspection_id
        and p.finding_id = f.id
    )
    and not exists (
      select 1 from public.inspection_photos p
      where p.tenant_id = f.tenant_id
        and p.inspection_id = f.inspection_id
        and p.finding_id = f.id
        and coalesce(p.is_voided, false) = false
        and p.upload_state = 'complete'
    );

  insert into public.inspection_events (
    tenant_id, inspection_id, event_type, event_at,
    actor_user_id, actor_technician_id, inspection_revision, metadata
  ) values (
    v_parent.tenant_id, v_parent.id, 'evidence_voided', v_now,
    auth.uid(),
    (select t.id from public.technicians t where t.user_id = auth.uid() limit 1),
    v_parent.revision,
    jsonb_build_object(
      'photo_id', v_photo.id,
      'reason', p_reason,
      'pending_suggestions_inactivated', v_inactivated,
      'findings_without_active_evidence', to_jsonb(v_affected_finding_ids)
    )
  );

  return v_photo;
end;
$$;

create or replace function public.inspection_finalization_preflight(p_tenant_id text, p_inspection_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_issues jsonb;
  v_extra jsonb := '[]'::jsonb;
  v_row public.inspections;
  v_finding record;
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  select * into v_row from public.inspections where id = p_inspection_id and tenant_id = p_tenant_id;
  if not found then raise exception 'inspection_not_found'; end if;
  v_issues := public.inspection_report_coherence_issues(p_tenant_id, p_inspection_id);

  if coalesce(v_row.summary_status, 'draft') = 'stale' then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object(
      'code', 'SUMMARY_REQUIRED',
      'message', 'Findings narrative is stale after condition changes. Regenerate or re-accept the narrative.',
      'action', 'Review findings narrative'
    ));
  elsif nullif(trim(coalesce(v_row.summary, '')), '') is null then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object(
      'code', 'SUMMARY_REQUIRED',
      'message', 'Generate and accept the customer Findings narrative.',
      'action', 'Edit findings narrative'
    ));
  end if;

  -- Only pending AI on active (non-voided) photos blocks finalization.
  if exists (
    select 1
    from public.inspection_ai_suggestions s
    join public.inspection_photos p
      on p.id = s.photo_id
     and p.tenant_id = s.tenant_id
    where s.tenant_id = p_tenant_id
      and s.inspection_id = p_inspection_id
      and s.inspection_revision = v_row.revision
      and s.status = 'pending'
      and coalesce(p.is_voided, false) = false
  ) then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object(
      'code', 'AI_DECISIONS_PENDING',
      'message', 'One or more photos still need a technician decision.',
      'action', 'Review photo decisions'
    ));
  end if;

  -- Approved conditions that lost all active evidence after voiding need human review.
  for v_finding in
    select f.id
    from public.inspection_findings f
    where f.tenant_id = p_tenant_id
      and f.inspection_id = p_inspection_id
      and exists (
        select 1 from public.inspection_photos p
        where p.tenant_id = f.tenant_id
          and p.inspection_id = f.inspection_id
          and p.finding_id = f.id
      )
      and not exists (
        select 1 from public.inspection_photos p
        where p.tenant_id = f.tenant_id
          and p.inspection_id = f.inspection_id
          and p.finding_id = f.id
          and coalesce(p.is_voided, false) = false
          and p.upload_state = 'complete'
      )
  loop
    v_extra := v_extra || jsonb_build_array(jsonb_build_object(
      'code', 'FINDING_WITHOUT_EVIDENCE',
      'finding_id', v_finding.id,
      'message', 'An approved condition no longer has active evidence after a photo was voided. Review the condition or add replacement evidence.',
      'action', 'Open affected findings'
    ));
  end loop;

  if not exists (select 1 from public.inspection_findings f where f.tenant_id=p_tenant_id and f.inspection_id=p_inspection_id and f.is_customer_visible=true) then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object('code','NO_CUSTOMER_FINDINGS','message','No findings are approved for the customer report.','action','Review finding'));
  end if;
  if exists (select 1 from public.inspection_findings f where f.tenant_id=p_tenant_id and f.inspection_id=p_inspection_id and f.is_customer_visible=true
    and not exists (select 1 from public.inspection_recommendations r where r.tenant_id=p_tenant_id and r.finding_id=f.id and r.is_customer_visible=true)) then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object('code','RECOMMENDATION_REQUIRED','message','Each customer-visible finding needs a selected recommendation.','action','Select recommendation'));
  end if;
  return coalesce(v_issues, '[]'::jsonb) || v_extra;
end;
$$;

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
  -- Required for updates while status is submitted/completed (Finalize-after-Submit).
  perform set_config('app.inspection_transition', '1', true);
  update public.inspections set reviewed_at = now(), reviewed_by_user_id = v_user, reviewed_revision = revision
  where id = p_inspection_id returning * into v_row;
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, p_inspection_id, 'report_reviewed', v_user, p_expected_revision,
    jsonb_build_object('ai_is_advisory', true, 'coherence_gate', 'passed'));
  return v_row;
end;
$$;

grant execute on function public.inspection_void_photo_unchecked(text, uuid, text) to service_role;
grant execute on function public.inspection_finalization_preflight(text, uuid) to authenticated, service_role;
grant execute on function public.inspection_mark_reviewed(text, uuid, integer) to authenticated, service_role;

-- Backfill: inactivate leftover pending AI on already-voided photos (preserve audit rows).
update public.inspection_ai_suggestions s
set
  status = 'irrelevant',
  reviewed_at = coalesce(s.reviewed_at, now()),
  reviewed_content = coalesce(s.reviewed_content, s.content, '{}'::jsonb)
    || jsonb_build_object('inactive_reason', 'photo_voided_backfill')
from public.inspection_photos p
where p.id = s.photo_id
  and p.tenant_id = s.tenant_id
  and coalesce(p.is_voided, false) = true
  and s.status = 'pending';

commit;
