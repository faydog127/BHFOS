begin;

alter table public.inspections
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_revision integer;

create table if not exists public.inspection_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  inspection_revision integer not null,
  photo_id uuid references public.inspection_photos(id) on delete restrict,
  suggestion_version integer not null default 1,
  suggestion_type text not null check (suggestion_type in ('finding', 'report_narrative')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'edited', 'rejected')),
  model text not null,
  prompt_version text not null,
  content jsonb not null,
  reviewed_content jsonb,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inspection_ai_no_pricing check (
    not (content ?| array['price', 'pricing', 'amount', 'unit_price', 'total_price'])
    and (reviewed_content is null or not (reviewed_content ?| array['price', 'pricing', 'amount', 'unit_price', 'total_price']))
  ),
  unique (tenant_id, inspection_id, inspection_revision, photo_id, suggestion_type, suggestion_version)
);

create index if not exists inspection_ai_suggestions_review_idx
  on public.inspection_ai_suggestions (tenant_id, inspection_id, inspection_revision, status);

alter table public.inspection_ai_suggestions enable row level security;

create policy "Inspection AI suggestions readable by tenant" on public.inspection_ai_suggestions
  for select to authenticated
  using (
    public.inspection_tenant_access(tenant_id)
    and exists (select 1 from public.inspections i where i.id = inspection_id and i.tenant_id = tenant_id)
  );

create policy "Inspection AI suggestions service role full access" on public.inspection_ai_suggestions
  for all to service_role using (true) with check (true);

create or replace function public.inspection_review_ai_suggestion(
  p_tenant_id text, p_suggestion_id uuid, p_action text, p_reviewed_content jsonb default null
) returns public.inspection_ai_suggestions
language plpgsql security definer set search_path = public, auth as $$
declare
  v_suggestion public.inspection_ai_suggestions;
  v_user uuid := auth.uid();
  v_content jsonb;
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  if p_action not in ('accept', 'edit', 'reject') then raise exception 'invalid_review_action'; end if;

  select * into v_suggestion from public.inspection_ai_suggestions
  where id = p_suggestion_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'suggestion_not_found'; end if;
  if v_suggestion.status <> 'pending' then raise exception 'suggestion_already_reviewed'; end if;

  v_content := case when p_action = 'edit' then p_reviewed_content else v_suggestion.content end;
  if p_action = 'edit' and (v_content is null or jsonb_typeof(v_content) <> 'object') then raise exception 'reviewed_content_required'; end if;
  if v_content ?| array['price', 'pricing', 'amount', 'unit_price', 'total_price'] then raise exception 'ai_pricing_not_allowed'; end if;

  update public.inspection_ai_suggestions set
    status = case p_action when 'accept' then 'accepted' when 'edit' then 'edited' else 'rejected' end,
    reviewed_content = case when p_action = 'reject' then null else v_content end,
    reviewed_at = now(), reviewed_by_user_id = v_user
  where id = p_suggestion_id returning * into v_suggestion;

  if p_action <> 'reject' and v_suggestion.suggestion_type = 'finding' then
    insert into public.inspection_findings (
      tenant_id, inspection_id, title, description, severity, category, recommended_action,
      is_customer_visible, created_by_user_id
    ) values (
      p_tenant_id, v_suggestion.inspection_id, coalesce(v_content->>'title', 'AI-assisted finding'),
      v_content->>'description', coalesce(v_content->>'severity', 'informational'),
      v_content->>'category', v_content->>'recommended_action', false, v_user
    );
  elsif p_action <> 'reject' and v_suggestion.suggestion_type = 'report_narrative' then
    update public.inspections
    set summary = coalesce(v_content->>'narrative', summary), updated_at = now()
    where id = v_suggestion.inspection_id and tenant_id = p_tenant_id;
  end if;

  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, v_suggestion.inspection_id, 'ai_suggestion_' || p_action, v_user,
    v_suggestion.inspection_revision, jsonb_build_object('suggestion_id', v_suggestion.id, 'photo_id', v_suggestion.photo_id));
  return v_suggestion;
end;
$$;

create or replace function public.inspection_mark_reviewed(p_tenant_id text, p_inspection_id uuid, p_expected_revision integer)
returns public.inspections language plpgsql security definer set search_path = public, auth as $$
declare v_row public.inspections; v_user uuid := auth.uid();
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  select * into v_row from public.inspections where id = p_inspection_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'inspection_not_found'; end if;
  if v_row.revision <> p_expected_revision then raise exception 'stale_revision'; end if;
  if exists (select 1 from public.inspection_ai_suggestions where tenant_id = p_tenant_id and inspection_id = p_inspection_id and inspection_revision = p_expected_revision and status = 'pending') then
    raise exception 'pending_ai_suggestions';
  end if;
  update public.inspections set reviewed_at = now(), reviewed_by_user_id = v_user, reviewed_revision = revision
  where id = p_inspection_id returning * into v_row;
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, p_inspection_id, 'report_reviewed', v_user, p_expected_revision, jsonb_build_object('ai_is_advisory', true));
  return v_row;
end;
$$;

grant execute on function public.inspection_review_ai_suggestion(text, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.inspection_mark_reviewed(text, uuid, integer) to authenticated, service_role;

commit;
