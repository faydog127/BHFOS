-- P0b: Bridge preflight to narrative + one inspection-level recommendation.
-- Removes per-finding customer-finding / customer-recommendation gates.
-- Does not implement Phase C UI; existing finding_id-null recommendations satisfy the bridge.

begin;

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
  elsif nullif(trim(coalesce(v_row.summary, '')), '') is null
     or coalesce(v_row.summary_status, 'draft') not in ('accepted', 'edited') then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object(
      'code', 'SUMMARY_REQUIRED',
      'message', 'Generate and accept the customer Findings narrative.',
      'action', 'Edit findings narrative'
    ));
  end if;

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

  -- Bridge until Phase C: require one inspection-level customer recommendation (finding_id is null).
  if not exists (
    select 1
    from public.inspection_recommendations r
    where r.tenant_id = p_tenant_id
      and r.inspection_id = p_inspection_id
      and r.finding_id is null
      and r.is_customer_visible = true
  ) then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object(
      'code', 'RECOMMENDATION_REQUIRED',
      'message', 'Add one inspection-level Service Recommendation for the customer report. Pricing stays in Estimates.',
      'action', 'Add service recommendation'
    ));
  end if;

  return coalesce(v_issues, '[]'::jsonb) || v_extra;
end;
$$;

grant execute on function public.inspection_finalization_preflight(text, uuid) to authenticated, service_role;

commit;
