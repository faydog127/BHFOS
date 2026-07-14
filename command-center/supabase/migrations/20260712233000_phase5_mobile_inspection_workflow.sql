begin;

alter table public.inspection_photos
  add column if not exists quality_status text not null default 'unchecked'
    check (quality_status in ('unchecked', 'good', 'retake_recommended', 'kept_with_warning')),
  add column if not exists quality_warnings jsonb not null default '[]'::jsonb,
  add column if not exists quality_metrics jsonb not null default '{}'::jsonb,
  add column if not exists quality_checked_at timestamptz;

alter table public.inspections
  add column if not exists inspection_type text,
  add column if not exists summary_status text not null default 'draft'
    check (summary_status in ('draft', 'generated', 'accepted', 'edited')),
  add column if not exists summary_source_revision integer,
  add column if not exists summary_reviewed_at timestamptz,
  add column if not exists summary_reviewed_by uuid references auth.users(id) on delete set null;

create or replace function public.inspection_review_ai_photo_package(
  p_tenant_id text,
  p_photo_id uuid,
  p_action text,
  p_reviewed_content jsonb default null,
  p_internal_only boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inspection public.inspections;
  v_photo public.inspection_photos;
  v_version integer;
  v_finding_suggestion public.inspection_ai_suggestions;
  v_narrative_suggestion public.inspection_ai_suggestions;
  v_content jsonb;
  v_finding_id uuid;
  v_recommendation text;
  v_recommendation_id uuid;
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  if p_action not in ('accept', 'edit', 'reject', 'irrelevant') then raise exception 'invalid_review_action'; end if;

  select * into v_photo from public.inspection_photos
  where id = p_photo_id and tenant_id = p_tenant_id and coalesce(is_voided, false) = false for update;
  if not found then raise exception 'photo_not_found'; end if;
  select * into v_inspection from public.inspections
  where id = v_photo.inspection_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'inspection_not_found'; end if;

  select max(suggestion_version) into v_version from public.inspection_ai_suggestions
  where tenant_id = p_tenant_id and inspection_id = v_photo.inspection_id
    and inspection_revision = v_inspection.revision and photo_id = p_photo_id;
  if v_version is null then raise exception 'photo_analysis_not_found'; end if;

  select * into v_finding_suggestion from public.inspection_ai_suggestions
  where tenant_id = p_tenant_id and inspection_id = v_photo.inspection_id
    and inspection_revision = v_inspection.revision and photo_id = p_photo_id
    and suggestion_version = v_version and suggestion_type = 'finding' for update;
  select * into v_narrative_suggestion from public.inspection_ai_suggestions
  where tenant_id = p_tenant_id and inspection_id = v_photo.inspection_id
    and inspection_revision = v_inspection.revision and photo_id = p_photo_id
    and suggestion_version = v_version and suggestion_type = 'report_narrative' for update;

  if p_action in ('reject', 'irrelevant') then
    update public.inspection_ai_suggestions set
      status = case when p_action = 'irrelevant' then 'irrelevant' else 'rejected' end,
      reviewed_at = now(), reviewed_by_user_id = auth.uid()
    where tenant_id = p_tenant_id and inspection_id = v_photo.inspection_id
      and inspection_revision = v_inspection.revision and photo_id = p_photo_id
      and suggestion_version = v_version;
    update public.inspection_findings f set is_customer_visible = false, updated_at = now()
    where f.tenant_id = p_tenant_id and f.inspection_id = v_photo.inspection_id
      and exists (select 1 from public.inspection_ai_suggestions s
        where s.id = f.source_ai_suggestion_id and s.photo_id = p_photo_id);
  else
    if v_finding_suggestion.id is null then raise exception 'finding_suggestion_not_found'; end if;
    v_content := coalesce(v_finding_suggestion.reviewed_content, v_finding_suggestion.content) || coalesce(p_reviewed_content, '{}'::jsonb);
    v_recommendation := nullif(trim(coalesce(v_content->>'recommendation', v_content->>'recommended_action', '')), '');

    select f.id into v_finding_id from public.inspection_findings f
    join public.inspection_ai_suggestions s on s.id = f.source_ai_suggestion_id
    where f.tenant_id = p_tenant_id and f.inspection_id = v_photo.inspection_id and s.photo_id = p_photo_id
    order by f.created_at limit 1 for update of f;

    if v_finding_id is null then
      insert into public.inspection_findings (
        tenant_id, inspection_id, title, category, severity, description, recommended_action,
        is_customer_visible, source_ai_suggestion_id, created_by_user_id
      ) values (
        p_tenant_id, v_photo.inspection_id, coalesce(nullif(v_content->>'title', ''), 'Technician-approved finding'),
        nullif(v_content->>'category', ''), nullif(v_content->>'severity', ''), nullif(v_content->>'description', ''),
        v_recommendation, not p_internal_only, v_finding_suggestion.id, auth.uid()
      ) returning id into v_finding_id;
    else
      update public.inspection_findings set
        title = coalesce(nullif(v_content->>'title', ''), title), category = coalesce(nullif(v_content->>'category', ''), category),
        severity = coalesce(nullif(v_content->>'severity', ''), severity), description = coalesce(nullif(v_content->>'description', ''), description),
        recommended_action = v_recommendation, is_customer_visible = not p_internal_only,
        source_ai_suggestion_id = v_finding_suggestion.id, updated_at = now()
      where id = v_finding_id;
    end if;

    update public.inspection_photos set finding_id = v_finding_id,
      caption = coalesce(nullif(v_content->>'customer_caption', ''), caption), updated_at = now()
    where id = p_photo_id;

    if v_recommendation is not null then
      select id into v_recommendation_id from public.inspection_recommendations
      where tenant_id = p_tenant_id and inspection_id = v_photo.inspection_id and finding_id = v_finding_id
      order by created_at limit 1 for update;
      if v_recommendation_id is null then
        insert into public.inspection_recommendations (
          tenant_id, inspection_id, finding_id, title, description, is_customer_visible, created_by_user_id
        ) values (p_tenant_id, v_photo.inspection_id, v_finding_id, v_recommendation, v_recommendation, not p_internal_only, auth.uid())
        returning id into v_recommendation_id;
      else
        update public.inspection_recommendations set title = v_recommendation, description = v_recommendation,
          is_customer_visible = not p_internal_only, updated_at = now() where id = v_recommendation_id;
      end if;
      update public.inspection_photos set recommendation_id = v_recommendation_id where id = p_photo_id;
    end if;

    update public.inspection_ai_suggestions set
      status = case when p_action = 'edit' then 'edited' else 'accepted' end,
      reviewed_content = case
        when suggestion_type = 'finding' then v_content
        when suggestion_type = 'report_narrative' then coalesce(reviewed_content, content) ||
          jsonb_build_object('approved_for_summary', true)
        else reviewed_content end,
      reviewed_at = now(), reviewed_by_user_id = auth.uid()
    where tenant_id = p_tenant_id and inspection_id = v_photo.inspection_id
      and inspection_revision = v_inspection.revision and photo_id = p_photo_id
      and suggestion_version = v_version;
  end if;

  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, v_photo.inspection_id, 'ai_photo_package_' || p_action, auth.uid(), v_inspection.revision,
    jsonb_build_object('photo_id', p_photo_id, 'suggestion_version', v_version, 'finding_id', v_finding_id,
      'recommendation_id', v_recommendation_id, 'customer_visible', p_action in ('accept', 'edit') and not p_internal_only));

  return jsonb_build_object('photo_id', p_photo_id, 'decision', p_action, 'suggestion_version', v_version,
    'finding_id', v_finding_id, 'recommendation_id', v_recommendation_id,
    'customer_visible', p_action in ('accept', 'edit') and not p_internal_only);
end;
$$;

create or replace function public.inspection_set_finding_visibility(
  p_tenant_id text, p_finding_id uuid, p_customer_visible boolean
) returns public.inspection_findings
language plpgsql security definer set search_path = public, auth as $$
declare v_row public.inspection_findings; v_revision integer;
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  update public.inspection_findings set is_customer_visible = p_customer_visible, updated_at = now()
  where id = p_finding_id and tenant_id = p_tenant_id returning * into v_row;
  if not found then raise exception 'finding_not_found'; end if;
  update public.inspection_recommendations set is_customer_visible = p_customer_visible, updated_at = now()
  where tenant_id = p_tenant_id and finding_id = p_finding_id;
  select revision into v_revision from public.inspections where id = v_row.inspection_id;
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, v_row.inspection_id, 'finding_visibility_changed', auth.uid(), v_revision,
    jsonb_build_object('finding_id', p_finding_id, 'customer_visible', p_customer_visible));
  return v_row;
end;
$$;

create or replace function public.inspection_finalization_preflight(p_tenant_id text, p_inspection_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_issues jsonb; v_extra jsonb := '[]'::jsonb; v_row public.inspections;
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  select * into v_row from public.inspections where id = p_inspection_id and tenant_id = p_tenant_id;
  if not found then raise exception 'inspection_not_found'; end if;
  v_issues := public.inspection_report_coherence_issues(p_tenant_id, p_inspection_id);
  if nullif(trim(coalesce(v_row.summary, '')), '') is null then
    v_extra := v_extra || jsonb_build_array(jsonb_build_object('code','SUMMARY_REQUIRED','message','Review and accept the generated inspection summary.','action','Edit summary'));
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

create or replace function public.inspection_finalize_phase5(p_tenant_id text, p_inspection_id uuid, p_expected_revision integer)
returns public.inspections language plpgsql security definer set search_path = public, auth as $$
declare v_issues jsonb; v_row public.inspections;
begin
  v_issues := public.inspection_finalization_preflight(p_tenant_id, p_inspection_id);
  if jsonb_array_length(v_issues) > 0 then
    raise exception using errcode='P0001', message='inspection_preflight_failed', detail=v_issues::text;
  end if;
  v_row := public.inspection_mark_reviewed(p_tenant_id, p_inspection_id, p_expected_revision);
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, p_inspection_id, 'inspection_finalized_phase5', auth.uid(), p_expected_revision,
    jsonb_build_object('coherence_gate','passed'));
  return v_row;
end;
$$;

grant execute on function public.inspection_review_ai_photo_package(text, uuid, text, jsonb, boolean) to authenticated, service_role;
grant execute on function public.inspection_set_finding_visibility(text, uuid, boolean) to authenticated, service_role;
grant execute on function public.inspection_finalization_preflight(text, uuid) to authenticated, service_role;
grant execute on function public.inspection_finalize_phase5(text, uuid, integer) to authenticated, service_role;

commit;
