begin;

create table if not exists public.inspection_price_book_mapping_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  finding_category text,
  match_terms text[] not null default '{}',
  price_book_code text not null,
  confidence text not null check (confidence in ('high', 'medium')),
  match_reason text not null,
  applicable_conditions jsonb not null default '{}'::jsonb,
  exclusions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, finding_category, price_book_code)
);

alter table public.inspection_price_book_mapping_rules enable row level security;
create policy "Inspection quote rules readable by tenant" on public.inspection_price_book_mapping_rules
  for select to authenticated using (tenant_id = 'default' or public.inspection_tenant_access(tenant_id));
create policy "Inspection quote rules service role full access" on public.inspection_price_book_mapping_rules
  for all to service_role using (true) with check (true);

insert into public.inspection_price_book_mapping_rules
  (tenant_id, finding_category, match_terms, price_book_code, confidence, match_reason, applicable_conditions)
values
  ('default', 'blower', array['blower wheel','blower assembly'], 'DUCT-BLOW', 'high', 'Blower cleaning matches the approved finding.', '{"system":"hvac"}'),
  ('default', 'coil', array['evaporator coil','coil cleaning'], 'COIL-CLEAN', 'high', 'Coil cleaning matches the approved finding.', '{"system":"hvac"}'),
  ('default', 'dryer_vent', array['lint','restriction','dryer vent cleaning'], 'DV-STD', 'high', 'Standard dryer vent service matches the approved finding.', '{"service":"dryer_vent"}'),
  ('default', 'termination', array['termination','vent hood','exterior hood'], 'EXT-HOOD-NO', 'medium', 'An exterior termination item may apply; confirm the condition.', '{"location":"exterior"}'),
  ('default', 'termination', array['termination','vent hood','exterior hood'], 'EXT-GUARD-STD', 'medium', 'An exterior guard may apply; choose only after site confirmation.', '{"location":"exterior"}'),
  ('default', 'air_duct', array['duct debris','air duct cleaning','contamination'], 'DUCT-SYS1', 'medium', 'Air-duct service may apply; confirm system size and scope.', '{"service":"air_duct"}')
on conflict (tenant_id, finding_category, price_book_code) do update set
  match_terms = excluded.match_terms, confidence = excluded.confidence,
  match_reason = excluded.match_reason, applicable_conditions = excluded.applicable_conditions, active = true;

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
  select * into v_quote from public.quotes where tenant_id = p_tenant_id and inspection_id = p_inspection_id and inspection_revision = p_expected_revision limit 1;
  return v_quote;
end; $$;

create or replace function public.inspection_confirm_quote_pricing(p_tenant_id text, p_inspection_id uuid, p_quote_id uuid)
returns public.quotes language plpgsql security definer set search_path = public, auth as $$
declare v_quote public.quotes; v_revision integer;
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  select q.* into v_quote from public.quotes q join public.inspections i on i.id = q.inspection_id and i.tenant_id = q.tenant_id
    where q.id = p_quote_id and q.inspection_id = p_inspection_id and q.tenant_id = p_tenant_id
      and i.reviewed_at is not null and i.reviewed_revision = i.revision for update;
  if not found then raise exception 'reviewed_inspection_quote_not_found'; end if;
  update public.quotes set inspection_human_reviewed_at = now(), inspection_human_reviewed_by = auth.uid(), updated_at = now()
    where id = p_quote_id returning * into v_quote;
  v_revision := v_quote.inspection_revision;
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, p_inspection_id, 'inspection_quote_pricing_reviewed', auth.uid(), v_revision,
    jsonb_build_object('quote_id', p_quote_id, 'authoritative_pricing_source', 'price_book_and_human_edits'));
  return v_quote;
end; $$;

grant execute on function public.inspection_create_quote_from_price_book(text, uuid, integer, uuid[]) to authenticated, service_role;
grant execute on function public.inspection_confirm_quote_pricing(text, uuid, uuid) to authenticated, service_role;

commit;
