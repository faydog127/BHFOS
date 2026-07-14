begin;

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
      v_content->>'category', v_content->>'recommended_action', true, v_user
    ) returning id into v_finding_id;
    update public.inspection_photos set finding_id = v_finding_id, updated_at = now()
    where id = v_suggestion.photo_id and tenant_id = p_tenant_id
      and inspection_id = v_suggestion.inspection_id and finding_id is null;
  elsif p_action <> 'reject' and v_suggestion.suggestion_type = 'report_narrative' then
    update public.inspections set summary = coalesce(v_content->>'narrative', summary), updated_at = now()
    where id = v_suggestion.inspection_id and tenant_id = p_tenant_id;
  end if;

  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, v_suggestion.inspection_id, 'ai_suggestion_' || p_action, v_user,
    v_suggestion.inspection_revision, jsonb_build_object('suggestion_id', v_suggestion.id, 'photo_id', v_suggestion.photo_id,
      'customer_visible_finding', p_action <> 'reject' and v_suggestion.suggestion_type = 'finding'));
  return v_suggestion;
end;
$$;

grant execute on function public.inspection_review_ai_suggestion(text, uuid, text, jsonb) to authenticated, service_role;

create or replace function public.inspection_create_quote_from_price_book(
  p_tenant_id text, p_inspection_id uuid, p_expected_revision integer, p_price_book_ids uuid[]
) returns public.quotes language plpgsql security definer set search_path = public, auth as $$
declare
  v_inspection public.inspections; v_quote public.quotes; v_subtotal numeric; v_findings text;
  v_ids uuid[] := coalesce(p_price_book_ids, '{}'::uuid[]); v_user uuid := auth.uid();
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  select * into v_inspection from public.inspections where id = p_inspection_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'inspection_not_found'; end if;
  if v_inspection.revision <> p_expected_revision then raise exception 'stale_revision'; end if;
  if v_inspection.reviewed_at is null or v_inspection.reviewed_revision <> v_inspection.revision then raise exception 'inspection_not_reviewed'; end if;
  if v_inspection.lead_id is null then raise exception 'inspection_lead_required'; end if;
  select * into v_quote from public.quotes where tenant_id = p_tenant_id and inspection_id = p_inspection_id and inspection_revision = p_expected_revision limit 1;
  if found then return v_quote; end if;
  if (select count(*) from public.price_book where id = any(v_ids) and active and tenant_id in (p_tenant_id, 'default'))
      <> (select count(distinct id) from unnest(v_ids) id) then raise exception 'invalid_price_book_selection'; end if;
  select coalesce(sum(base_price), 0) into v_subtotal from public.price_book where id = any(v_ids) and active and tenant_id in (p_tenant_id, 'default');
  select string_agg(title, '; ' order by sort_order, created_at) into v_findings from public.inspection_findings
    where tenant_id = p_tenant_id and inspection_id = p_inspection_id and is_customer_visible = true;
  insert into public.quotes (tenant_id, lead_id, status, subtotal, tax_rate, tax_amount, total_amount, valid_until,
    header_text, footer_text, quote_number, public_token, inspection_id, inspection_revision, created_at, updated_at)
  values (p_tenant_id, v_inspection.lead_id, 'draft', v_subtotal, 0, 0, v_subtotal, now() + interval '14 days',
    concat('Inspection ', p_inspection_id, ' approved findings: ', coalesce(v_findings, 'No approved findings recorded'),
      '. Scope and pricing require human confirmation.'), 'Review scope and pricing before sending.',
    floor(100000 + random() * 899999)::integer, gen_random_uuid(), p_inspection_id, p_expected_revision, now(), now()) returning * into v_quote;
  insert into public.quote_items (quote_id, tenant_id, price_book_id, price_book_code, description, quantity, unit_price, total_price, created_at, updated_at)
  select v_quote.id, p_tenant_id, pb.id, pb.code, pb.name, 1, pb.base_price, pb.base_price, now(), now()
  from public.price_book pb where pb.id = any(v_ids) and pb.active and pb.tenant_id in (p_tenant_id, 'default');
  update public.inspections set quote_id = v_quote.id, updated_at = now() where id = p_inspection_id;
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, p_inspection_id, 'inspection_quote_created', v_user, p_expected_revision,
    jsonb_build_object('quote_id', v_quote.id, 'price_book_ids', v_ids, 'authoritative_pricing_source', 'price_book', 'requires_human_pricing_review', true));
  return v_quote;
exception when unique_violation then
  select * into v_quote from public.quotes where tenant_id = p_tenant_id
    and inspection_id = p_inspection_id and inspection_revision = p_expected_revision limit 1;
  if found then return v_quote; end if;
  raise;
end; $$;

grant execute on function public.inspection_create_quote_from_price_book(text, uuid, integer, uuid[]) to authenticated, service_role;

commit;
