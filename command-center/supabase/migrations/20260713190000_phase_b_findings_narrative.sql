-- Phase B: Findings narrative status + fingerprint for stale detection.
-- Does not change PDF rendering or recommendation model.
-- Lightweight preflight: stale narrative blocks finalization via SUMMARY_REQUIRED.

begin;

alter table public.inspections
  drop constraint if exists inspections_summary_status_check;

alter table public.inspections
  add column if not exists summary_conditions_fingerprint text;

alter table public.inspections
  add constraint inspections_summary_status_check
  check (summary_status in ('draft', 'generated', 'accepted', 'edited', 'stale'));

create or replace function public.inspection_finalization_preflight(p_tenant_id text, p_inspection_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_issues jsonb; v_extra jsonb := '[]'::jsonb; v_row public.inspections;
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
  if exists (select 1 from public.inspection_ai_suggestions s where s.tenant_id=p_tenant_id and s.inspection_id=p_inspection_id and s.inspection_revision=v_row.revision and s.status='pending') then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object('code','AI_DECISIONS_PENDING','message','One or more photos still need a technician decision.','action','Review finding'));
  end if;
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

grant execute on function public.inspection_finalization_preflight(text, uuid) to authenticated, service_role;

commit;
