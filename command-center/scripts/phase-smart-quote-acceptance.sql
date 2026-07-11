\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.leads (id, tenant_id, first_name, last_name, email, status)
values ('91000000-0000-0000-0000-000000000001', 'phase-smart-test', 'Synthetic', 'Customer', 'synthetic@example.com', 'active');

insert into public.inspections (id, tenant_id, lead_id, status, title, revision, reviewed_at, reviewed_revision)
values
  ('92000000-0000-0000-0000-000000000001', 'phase-smart-test', '91000000-0000-0000-0000-000000000001', 'completed', 'Smart quote acceptance', 1, now(), 1),
  ('92000000-0000-0000-0000-000000000002', 'phase-smart-test', '91000000-0000-0000-0000-000000000001', 'completed', 'No match acceptance', 1, now(), 1);

insert into public.inspection_findings (id, tenant_id, inspection_id, title, category, severity, recommended_action, is_customer_visible, sort_order)
values
  ('93000000-0000-0000-0000-000000000001', 'phase-smart-test', '92000000-0000-0000-0000-000000000001', 'Blower wheel impacted', 'blower', 'medium', 'Clean blower assembly', true, 1),
  ('93000000-0000-0000-0000-000000000002', 'phase-smart-test', '92000000-0000-0000-0000-000000000001', 'Exterior termination damaged', 'termination', 'high', 'Replace exterior hood or install guard after confirmation', true, 2),
  ('93000000-0000-0000-0000-000000000003', 'phase-smart-test', '92000000-0000-0000-0000-000000000001', 'Custom roof condition', 'roof', 'low', 'Office review required', true, 3),
  ('93000000-0000-0000-0000-000000000004', 'phase-smart-test', '92000000-0000-0000-0000-000000000001', 'Rejected raw suggestion', 'coil', 'high', 'Clean coil', false, 4);

insert into public.inspection_ai_suggestions
  (tenant_id, inspection_id, inspection_revision, suggestion_version, suggestion_type, status, model, prompt_version, content)
values
  ('phase-smart-test', '92000000-0000-0000-0000-000000000001', 1, 1, 'finding', 'pending', 'test-model', 'test-prompt', '{"title":"Raw dryer vent suggestion"}'),
  ('phase-smart-test', '92000000-0000-0000-0000-000000000001', 1, 1, 'finding', 'rejected', 'test-model', 'test-prompt', '{"title":"Rejected coil suggestion"}');

do $$
declare v_exact bigint; v_ambiguous bigint; v_hidden bigint; v_quote public.quotes; v_repeat public.quotes; v_blank public.quotes; v_price numeric;
begin
  select count(*) into v_exact from public.inspection_suggest_price_book_items('phase-smart-test', '92000000-0000-0000-0000-000000000001')
    where finding_id = '93000000-0000-0000-0000-000000000001' and price_book_code = 'DUCT-BLOW' and confidence = 'high' and candidate_count = 1;
  if v_exact <> 1 then raise exception 'exact mapping failed'; end if;
  select count(*) into v_ambiguous from public.inspection_suggest_price_book_items('phase-smart-test', '92000000-0000-0000-0000-000000000001')
    where finding_id = '93000000-0000-0000-0000-000000000002' and candidate_count = 2;
  if v_ambiguous <> 2 then raise exception 'ambiguous mapping failed'; end if;
  select count(*) into v_hidden from public.inspection_suggest_price_book_items('phase-smart-test', '92000000-0000-0000-0000-000000000001')
    where finding_id in ('93000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000004');
  if v_hidden <> 0 then raise exception 'no-match or hidden finding leaked'; end if;

  select * into v_quote from public.inspection_create_quote_from_price_book('phase-smart-test', '92000000-0000-0000-0000-000000000001', 1,
    array[(select id from public.price_book where tenant_id = 'default' and code = 'DUCT-BLOW')]::uuid[]);
  select unit_price into v_price from public.quote_items where quote_id = v_quote.id;
  if v_price <> 249 or v_quote.inspection_human_reviewed_at is not null then raise exception 'authoritative pricing or human gate failed'; end if;
  if v_quote.header_text like '%Rejected raw suggestion%' then raise exception 'hidden finding entered quote context'; end if;
  select * into v_repeat from public.inspection_create_quote_from_price_book('phase-smart-test', '92000000-0000-0000-0000-000000000001', 1, '{}'::uuid[]);
  if v_repeat.id <> v_quote.id then raise exception 'duplicate quote created'; end if;
  select * into v_blank from public.inspection_create_quote_from_price_book('phase-smart-test', '92000000-0000-0000-0000-000000000002', 1, '{}'::uuid[]);
  if v_blank.total_amount <> 0 or exists (select 1 from public.quote_items where quote_id = v_blank.id) then raise exception 'blank no-match draft failed'; end if;
  select * into v_quote from public.inspection_confirm_quote_pricing('phase-smart-test', '92000000-0000-0000-0000-000000000001', v_quote.id);
  if v_quote.inspection_human_reviewed_at is null then raise exception 'pricing confirmation failed'; end if;
end $$;

do $$ begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"tenant_id":"other-tenant"}}', true);
  begin
    perform * from public.inspection_suggest_price_book_items('phase-smart-test', '92000000-0000-0000-0000-000000000001');
    if found then raise exception 'cross tenant suggestions exposed'; end if;
  exception when insufficient_privilege then null; end;
end $$;

rollback;
\echo 'SMART_QUOTE_ACCEPTANCE_PASS'
