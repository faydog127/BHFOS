-- Phase A: AI photo-package acceptance creates internal structured conditions only.
-- Does not create customer-facing recommendations. Does not rewrite historical rows.
-- PDF and finalization/preflight rules intentionally unchanged.

begin;

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
begin
  -- p_internal_only retained for API compatibility. Phase A AI accept/edit always
  -- stores findings as internal; technicians may still change visibility via
  -- inspection_set_finding_visibility.
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
        v_recommendation, false, v_finding_suggestion.id, auth.uid()
      ) returning id into v_finding_id;
    else
      update public.inspection_findings set
        title = coalesce(nullif(v_content->>'title', ''), title),
        category = coalesce(nullif(v_content->>'category', ''), category),
        severity = coalesce(nullif(v_content->>'severity', ''), severity),
        description = coalesce(nullif(v_content->>'description', ''), description),
        recommended_action = v_recommendation,
        is_customer_visible = false,
        source_ai_suggestion_id = v_finding_suggestion.id,
        updated_at = now()
      where id = v_finding_id;
    end if;

    update public.inspection_photos set finding_id = v_finding_id,
      caption = coalesce(nullif(v_content->>'customer_caption', ''), caption), updated_at = now()
    where id = p_photo_id;

    -- Phase A: do not create or rewrite inspection_recommendations.
    -- recommended_action remains on the finding as internal corrective guidance.
    -- Existing photo.recommendation_id values are left untouched.

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
    jsonb_build_object(
      'photo_id', p_photo_id,
      'suggestion_version', v_version,
      'finding_id', v_finding_id,
      'recommendation_id', null,
      'customer_visible', false,
      'phase', 'A_internal_conditions'
    ));

  return jsonb_build_object(
    'photo_id', p_photo_id,
    'decision', p_action,
    'suggestion_version', v_version,
    'finding_id', v_finding_id,
    'recommendation_id', null,
    'customer_visible', false
  );
end;
$$;

grant execute on function public.inspection_review_ai_photo_package(text, uuid, text, jsonb, boolean) to authenticated, service_role;

commit;
