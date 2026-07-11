\set ON_ERROR_STOP on

begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quote_items'
      and column_name = 'updated_at'
      and is_nullable = 'NO'
      and column_default is not null
  ) then
    raise exception 'quote_items.updated_at compatibility column is missing';
  end if;
end $$;

insert into public.leads (id, tenant_id, first_name, last_name, email, status)
values
  ('a1500000-0000-0000-0000-000000000001', 'quote-compat-test', 'Synthetic', 'Inspection', 'quote-compat@example.com', 'active'),
  ('a1500000-0000-0000-0000-000000000004', 'quote-compat-test', 'Synthetic', 'Ordinary', 'ordinary-quote-compat@example.com', 'active');

insert into public.inspections (id, tenant_id, lead_id, status, title, revision, reviewed_at, reviewed_revision)
values ('a1500000-0000-0000-0000-000000000002', 'quote-compat-test', 'a1500000-0000-0000-0000-000000000001',
  'completed', 'QUOTE ITEMS COMPATIBILITY TEST', 1, now(), 1);

insert into public.inspection_findings
  (id, tenant_id, inspection_id, title, category, severity, recommended_action, is_customer_visible)
values ('a1500000-0000-0000-0000-000000000003', 'quote-compat-test', 'a1500000-0000-0000-0000-000000000002',
  'Blower assembly impacted', 'blower', 'medium', 'Clean blower assembly', true);

do $$
declare
  v_price_id uuid;
  v_price numeric;
  v_quote public.quotes;
  v_repeat public.quotes;
  v_item public.quote_items;
  v_ordinary_quote public.quotes;
  v_ordinary_item public.quote_items;
begin
  select id, base_price into v_price_id, v_price
  from public.price_book
  where tenant_id = 'default' and code = 'DUCT-BLOW' and active = true;
  if v_price_id is null then raise exception 'required price-book item unavailable'; end if;

  select * into v_quote from public.inspection_create_quote_from_price_book(
    'quote-compat-test', 'a1500000-0000-0000-0000-000000000002', 1, array[v_price_id]
  );
  select * into v_item from public.quote_items where quote_id = v_quote.id;
  if v_item.id is null or v_item.unit_price <> v_price or v_item.total_price <> v_price then
    raise exception 'authoritative price-book quote item failed';
  end if;
  if v_item.updated_at is null then raise exception 'quote item updated_at was not populated'; end if;

  select * into v_quote from public.inspection_confirm_quote_pricing(
    'quote-compat-test', 'a1500000-0000-0000-0000-000000000002', v_quote.id
  );
  if v_quote.inspection_human_reviewed_at is null then raise exception 'human pricing confirmation failed'; end if;

  select * into v_repeat from public.inspection_create_quote_from_price_book(
    'quote-compat-test', 'a1500000-0000-0000-0000-000000000002', 1, array[v_price_id]
  );
  if v_repeat.id <> v_quote.id then raise exception 'same revision created a duplicate quote'; end if;

  insert into public.quotes (tenant_id, lead_id, status, subtotal, tax_amount, total_amount, quote_number, created_at, updated_at)
  values ('quote-compat-test', 'a1500000-0000-0000-0000-000000000004', 'draft', 10, 0, 10, 815000, now(), now())
  returning * into v_ordinary_quote;
  insert into public.quote_items (quote_id, description, quantity, unit_price, total_price)
  values (v_ordinary_quote.id, 'Ordinary quote regression item', 1, 10, 10)
  returning * into v_ordinary_item;
  if v_ordinary_item.updated_at is null then raise exception 'ordinary quote item default failed'; end if;

  begin
    insert into public.quotes (id, tenant_id, status, quote_number)
    values (v_ordinary_quote.id, 'quote-compat-test', 'draft', 815001);
    raise exception 'unrelated uniqueness conflict was swallowed';
  exception when unique_violation then
    null;
  end;
end $$;

rollback;
\echo 'INSPECTION_QUOTE_ITEMS_COMPATIBILITY_PASS'
