begin;

alter table public.inspection_ai_suggestions
  drop constraint if exists inspection_ai_suggestions_status_check;

alter table public.inspection_ai_suggestions
  add constraint inspection_ai_suggestions_status_check
  check (status in ('pending', 'accepted', 'edited', 'rejected', 'irrelevant'));

alter table public.inspection_findings
  add column if not exists source_ai_suggestion_id uuid
  references public.inspection_ai_suggestions(id) on delete set null;

create unique index if not exists inspection_findings_ai_source_unique
  on public.inspection_findings (tenant_id, source_ai_suggestion_id)
  where source_ai_suggestion_id is not null;

create or replace function public.inspection_review_ai_suggestion(
  p_tenant_id text, p_suggestion_id uuid, p_action text, p_reviewed_content jsonb default null
) returns public.inspection_ai_suggestions
language plpgsql security definer set search_path = public, auth as $$
declare
  v_suggestion public.inspection_ai_suggestions;
  v_user uuid := auth.uid();
  v_content jsonb;
  v_finding_id uuid;
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  if p_action not in ('accept', 'edit', 'reject', 'irrelevant') then raise exception 'invalid_review_action'; end if;

  select * into v_suggestion from public.inspection_ai_suggestions
  where id = p_suggestion_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'suggestion_not_found'; end if;
  if v_suggestion.status <> 'pending' then raise exception 'suggestion_already_reviewed'; end if;

  v_content := case when p_action = 'edit' then p_reviewed_content else v_suggestion.content end;
  if p_action = 'edit' and (v_content is null or jsonb_typeof(v_content) <> 'object') then raise exception 'reviewed_content_required'; end if;
  if v_content ?| array['price', 'pricing', 'amount', 'unit_price', 'total_price'] then raise exception 'ai_pricing_not_allowed'; end if;

  update public.inspection_ai_suggestions set
    status = case p_action
      when 'accept' then 'accepted'
      when 'edit' then 'edited'
      when 'irrelevant' then 'irrelevant'
      else 'rejected'
    end,
    reviewed_content = case when p_action in ('reject', 'irrelevant') then null else v_content end,
    reviewed_at = now(), reviewed_by_user_id = v_user
  where id = p_suggestion_id returning * into v_suggestion;

  if p_action in ('accept', 'edit') and v_suggestion.suggestion_type = 'finding' then
    select finding_id into v_finding_id from public.inspection_photos
    where id = v_suggestion.photo_id and tenant_id = p_tenant_id
      and inspection_id = v_suggestion.inspection_id;

    if v_finding_id is not null and exists (
      select 1 from public.inspection_findings
      where id = v_finding_id and tenant_id = p_tenant_id
        and inspection_id = v_suggestion.inspection_id and source_ai_suggestion_id is not null
    ) then
      update public.inspection_findings set
        title = coalesce(v_content->>'title', title),
        description = v_content->>'description',
        severity = coalesce(v_content->>'severity', 'informational'),
        category = v_content->>'category',
        recommended_action = v_content->>'recommended_action',
        is_customer_visible = false,
        source_ai_suggestion_id = v_suggestion.id,
        updated_at = now()
      where id = v_finding_id and tenant_id = p_tenant_id;
    else
      insert into public.inspection_findings (
        tenant_id, inspection_id, title, description, severity, category, recommended_action,
        is_customer_visible, created_by_user_id, source_ai_suggestion_id
      ) values (
        p_tenant_id, v_suggestion.inspection_id, coalesce(v_content->>'title', 'AI-assisted finding'),
        v_content->>'description', coalesce(v_content->>'severity', 'informational'),
        v_content->>'category', v_content->>'recommended_action', false, v_user, v_suggestion.id
      ) returning id into v_finding_id;
      update public.inspection_photos set finding_id = v_finding_id, updated_at = now()
      where id = v_suggestion.photo_id and tenant_id = p_tenant_id
        and inspection_id = v_suggestion.inspection_id and finding_id is null;
    end if;
  elsif p_action in ('accept', 'edit') and v_suggestion.suggestion_type = 'report_narrative' then
    update public.inspections set summary = coalesce(v_content->>'narrative', summary), updated_at = now()
    where id = v_suggestion.inspection_id and tenant_id = p_tenant_id;
  end if;

  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, v_suggestion.inspection_id, 'ai_suggestion_' || p_action, v_user,
    v_suggestion.inspection_revision, jsonb_build_object(
      'suggestion_id', v_suggestion.id,
      'photo_id', v_suggestion.photo_id,
      'customer_visible_finding', false
    ));
  return v_suggestion;
end;
$$;

grant execute on function public.inspection_review_ai_suggestion(text, uuid, text, jsonb) to authenticated, service_role;

commit;
