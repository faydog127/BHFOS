begin;

alter table public.quotes
  add column if not exists inspection_id uuid references public.inspections(id) on delete set null,
  add column if not exists inspection_revision integer,
  add column if not exists inspection_human_reviewed_at timestamptz,
  add column if not exists inspection_human_reviewed_by uuid references auth.users(id) on delete set null;

create unique index if not exists quotes_one_per_inspection_revision_idx
  on public.quotes (tenant_id, inspection_id, inspection_revision)
  where inspection_id is not null;

alter table public.quote_items
  add column if not exists tenant_id text,
  add column if not exists price_book_id uuid references public.price_book(id) on delete set null,
  add column if not exists price_book_code text;

create table if not exists public.inspection_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  inspection_report_id uuid not null references public.inspection_reports(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  delivery_kind text not null check (delivery_kind in ('report_only', 'quote_with_report')),
  recipient text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  idempotency_key text not null,
  provider_id text,
  error_message text,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (tenant_id, idempotency_key)
);

alter table public.inspection_report_deliveries enable row level security;
create policy "Inspection report deliveries readable by tenant" on public.inspection_report_deliveries
  for select to authenticated using (public.inspection_tenant_access(tenant_id));
create policy "Inspection report deliveries service role full access" on public.inspection_report_deliveries
  for all to service_role using (true) with check (true);

create or replace function public.inspection_create_quote_from_price_book(
  p_tenant_id text, p_inspection_id uuid, p_expected_revision integer, p_price_book_ids uuid[]
) returns public.quotes language plpgsql security definer set search_path = public, auth as $$
declare
  v_inspection public.inspections;
  v_quote public.quotes;
  v_subtotal numeric;
  v_findings text;
  v_user uuid := auth.uid();
begin
  if not public.inspection_tenant_access(p_tenant_id) then raise exception 'tenant_access_denied'; end if;
  if coalesce(array_length(p_price_book_ids, 1), 0) = 0 then raise exception 'price_book_selection_required'; end if;

  select * into v_inspection from public.inspections
  where id = p_inspection_id and tenant_id = p_tenant_id for update;
  if not found then raise exception 'inspection_not_found'; end if;
  if v_inspection.revision <> p_expected_revision then raise exception 'stale_revision'; end if;
  if v_inspection.reviewed_at is null or v_inspection.reviewed_revision <> v_inspection.revision then raise exception 'inspection_not_reviewed'; end if;
  if v_inspection.lead_id is null then raise exception 'inspection_lead_required'; end if;

  select * into v_quote from public.quotes where tenant_id = p_tenant_id
    and inspection_id = p_inspection_id and inspection_revision = p_expected_revision limit 1;
  if found then return v_quote; end if;

  if (select count(*) from public.price_book where id = any(p_price_book_ids) and active = true and tenant_id in (p_tenant_id, 'default'))
      <> (select count(distinct id) from unnest(p_price_book_ids) id) then
    raise exception 'invalid_price_book_selection';
  end if;

  select coalesce(sum(base_price), 0) into v_subtotal from public.price_book
  where id = any(p_price_book_ids) and active = true and tenant_id in (p_tenant_id, 'default');
  select string_agg(title, '; ' order by sort_order, created_at) into v_findings
  from public.inspection_findings where tenant_id = p_tenant_id and inspection_id = p_inspection_id;

  insert into public.quotes (
    tenant_id, lead_id, status, subtotal, tax_rate, tax_amount, total_amount, valid_until,
    header_text, footer_text, quote_number, public_token, inspection_id, inspection_revision,
    inspection_human_reviewed_at, inspection_human_reviewed_by, created_at, updated_at
  ) values (
    p_tenant_id, v_inspection.lead_id, 'draft', v_subtotal, 0, 0, v_subtotal, now() + interval '14 days',
    concat('Inspection ', p_inspection_id, ' reviewed findings: ', coalesce(v_findings, 'No findings recorded'),
      '. Recommended work selected from the current price book.'),
    'Review scope and pricing before sending.', floor(100000 + random() * 899999)::integer, gen_random_uuid(),
    p_inspection_id, p_expected_revision, now(), v_user, now(), now()
  ) returning * into v_quote;

  insert into public.quote_items (quote_id, tenant_id, price_book_id, price_book_code, description, quantity, unit_price, total_price, created_at, updated_at)
  select v_quote.id, p_tenant_id, pb.id, pb.code, pb.name, 1, pb.base_price, pb.base_price, now(), now()
  from public.price_book pb where pb.id = any(p_price_book_ids) and pb.active = true and pb.tenant_id in (p_tenant_id, 'default');

  update public.inspections set quote_id = v_quote.id, updated_at = now() where id = p_inspection_id;
  insert into public.inspection_events (tenant_id, inspection_id, event_type, actor_user_id, inspection_revision, metadata)
  values (p_tenant_id, p_inspection_id, 'inspection_quote_created', v_user, p_expected_revision,
    jsonb_build_object('quote_id', v_quote.id, 'price_book_ids', p_price_book_ids, 'authoritative_pricing_source', 'price_book'));
  return v_quote;
exception when unique_violation then
  select * into v_quote from public.quotes where tenant_id = p_tenant_id
    and inspection_id = p_inspection_id and inspection_revision = p_expected_revision limit 1;
  return v_quote;
end;
$$;

grant execute on function public.inspection_create_quote_from_price_book(text, uuid, integer, uuid[]) to authenticated, service_role;

commit;
