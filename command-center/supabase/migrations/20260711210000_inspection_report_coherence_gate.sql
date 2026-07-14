begin;

create or replace function public.inspection_report_coherence_issues(
  p_tenant_id text,
  p_inspection_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_issues jsonb;
begin
  if not public.inspection_tenant_access(p_tenant_id) then
    raise exception 'tenant_access_denied';
  end if;

  with approved as (
    select
      f.id,
      f.title,
      f.category,
      f.severity,
      lower(concat_ws(' ', f.title, f.category, f.description, f.recommended_action)) as searchable,
      exists (
        select 1 from public.inspection_photos p
        where p.tenant_id = f.tenant_id
          and p.inspection_id = f.inspection_id
          and p.finding_id = f.id
          and coalesce(p.is_voided, false) = false
          and p.upload_state = 'complete'
      ) as has_evidence
    from public.inspection_findings f
    where f.tenant_id = p_tenant_id
      and f.inspection_id = p_inspection_id
      and f.is_customer_visible = true
  ), components(component) as (
    values ('blower'), ('coil'), ('dryer vent'), ('air duct'), ('duct'), ('register'), ('termination'), ('return air')
  ), uncertain as (
    select a.*, c.component
    from approved a join components c on a.searchable like '%' || c.component || '%'
    where a.searchable ~ '(cannot|can not|unable|not visible|not shown|does not show|unclear|insufficient|not confirmed|cannot be assessed|non-applicable)'
  ), actionable as (
    select a.*, c.component
    from approved a join components c on a.searchable like '%' || c.component || '%'
    where coalesce(lower(a.severity), '') not in ('informational', 'information')
      and coalesce(lower(a.category), '') not in ('documentation', 'non_applicable', 'non-applicable')
      and a.searchable !~ '(cannot|can not|unable|not visible|not shown|does not show|unclear|insufficient|not confirmed|cannot be assessed|non-applicable)'
  ), issue_rows as (
    select jsonb_build_object(
      'code', 'CUSTOMER_VISIBLE_TEST_LANGUAGE',
      'finding_id', a.id,
      'message', 'Customer-visible finding contains test or synthetic language.'
    ) issue
    from approved a
    where a.searchable ~ '\m(test|synthetic|uat|fixture|mock)\M'

    union all

    select jsonb_build_object(
      'code', 'FINDING_WITHOUT_EVIDENCE',
      'finding_id', a.id,
      'message', 'Customer-visible finding has no eligible linked evidence.'
    )
    from approved a
    where not a.has_evidence

    union all

    select distinct jsonb_build_object(
      'code', 'CONTRADICTORY_COMPONENT_CONCLUSION',
      'finding_id', x.id,
      'conflicting_finding_id', y.id,
      'component', x.component,
      'message', 'One approved finding says the component cannot be assessed while another recommends corrective work.'
    )
    from uncertain x join actionable y on y.component = x.component and y.id <> x.id

    union all

    select jsonb_build_object(
      'code', 'SUMMARY_FINDING_CONTRADICTION',
      'finding_id', a.id,
      'component', c.component,
      'message', 'The report summary says the component cannot be assessed while an approved finding recommends corrective work.'
    )
    from public.inspections i
    join components c on lower(coalesce(i.summary, '')) like '%' || c.component || '%'
    join actionable a on a.component = c.component
    where i.id = p_inspection_id
      and i.tenant_id = p_tenant_id
      and lower(coalesce(i.summary, '')) ~ '(cannot|can not|unable|not visible|not shown|does not show|unclear|insufficient|not confirmed|cannot be assessed)'
  )
  select coalesce(jsonb_agg(issue), '[]'::jsonb) into v_issues from issue_rows;

  return v_issues;
end;
$$;

grant execute on function public.inspection_report_coherence_issues(text, uuid) to authenticated, service_role;

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
  if exists (select 1 from public.inspection_ai_suggestions where tenant_id = p_tenant_id and inspection_id = p_inspection_id and inspection_revision = p_expected_revision and status = 'pending') then
    raise exception 'pending_ai_suggestions';
  end if;
  v_issues := public.inspection_report_coherence_issues(p_tenant_id, p_inspection_id);
  if jsonb_array_length(v_issues) > 0 then
    raise exception using errcode = 'P0001', message = 'report_coherence_failed', detail = v_issues::text;
  end if;
  update public.inspections set reviewed_at = now(), reviewed_by_user_id = v_user, reviewed_revision = revision
  where id = p_inspection_id returning * into v_row;
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, p_inspection_id, 'report_reviewed', v_user, p_expected_revision,
    jsonb_build_object('ai_is_advisory', true, 'coherence_gate', 'passed'));
  return v_row;
end;
$$;

grant execute on function public.inspection_mark_reviewed(text, uuid, integer) to authenticated, service_role;

create or replace function public.inspection_suggest_price_book_items(p_tenant_id text, p_inspection_id uuid)
returns table (
  finding_id uuid, finding_title text, finding_category text, price_book_id uuid,
  price_book_code text, price_book_name text, base_price numeric, confidence text,
  match_reason text, candidate_count bigint
) language sql security definer set search_path = public, auth as $$
  with approved as (
    select f.id, f.title, f.category,
      lower(concat_ws(' ', f.title, f.category, f.description, f.recommended_action)) as searchable
    from public.inspection_findings f
    where f.tenant_id = p_tenant_id and f.inspection_id = p_inspection_id
      and f.is_customer_visible = true and public.inspection_tenant_access(p_tenant_id)
      and coalesce(lower(f.severity), '') not in ('informational', 'information')
      and coalesce(lower(f.category), '') not in ('documentation', 'non_applicable', 'non-applicable')
      and lower(concat_ws(' ', f.title, f.category, f.description, f.recommended_action))
        !~ '(cannot|can not|unable|not visible|not shown|does not show|unclear|insufficient|not confirmed|cannot be assessed|non-applicable)'
      and lower(concat_ws(' ', f.title, f.category, f.description, f.recommended_action))
        !~ '\m(test|synthetic|uat|fixture|mock)\M'
      and exists (
        select 1 from public.inspection_photos p
        where p.tenant_id = f.tenant_id and p.inspection_id = f.inspection_id
          and p.finding_id = f.id and coalesce(p.is_voided, false) = false
          and p.upload_state = 'complete'
      )
  ), candidates as (
    select a.id finding_id, a.title finding_title, a.category finding_category,
      pb.id price_book_id, pb.code price_book_code, pb.name price_book_name, pb.base_price,
      r.confidence, r.match_reason
    from approved a
    join public.inspection_price_book_mapping_rules r
      on r.active and r.tenant_id in ('default', p_tenant_id)
      and (r.finding_category is null or lower(coalesce(a.category, '')) = lower(r.finding_category)
        or exists (select 1 from unnest(r.match_terms) term where a.searchable like '%' || lower(term) || '%'))
      and not exists (select 1 from unnest(r.exclusions) term where a.searchable like '%' || lower(term) || '%')
    join public.price_book pb on pb.code = r.price_book_code and pb.active = true
      and pb.tenant_id in (p_tenant_id, 'default')
  )
  select c.*, count(*) over (partition by c.finding_id) candidate_count from candidates c
  order by c.finding_title, case c.confidence when 'high' then 0 else 1 end, c.price_book_name;
$$;

grant execute on function public.inspection_suggest_price_book_items(text, uuid) to authenticated, service_role;

commit;
