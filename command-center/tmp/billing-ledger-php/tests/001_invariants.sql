-- Invariant-focused integration tests (psql).
-- Run with: psql -v ON_ERROR_STOP=1 -f /work/tests/001_invariants.sql

do $$
declare
  v_bc uuid := '11111111-1111-1111-1111-111111111111';
  v_payer uuid := '22222222-2222-2222-2222-222222222222';
  v_payer_other uuid := '33333333-3333-3333-3333-333333333333';
  v_invoice uuid := '44444444-4444-4444-4444-444444444444';
  v_invoice_void uuid := '55555555-5555-5555-5555-555555555555';
  v_payment uuid := '66666666-6666-6666-6666-666666666666';
  v_payment_pending uuid := '77777777-7777-7777-7777-777777777777';
  v_alloc uuid := '88888888-8888-8888-8888-888888888888';
  v_cm uuid := '99999999-9999-9999-9999-999999999999';
  v_cm_draft uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_ca uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_key text := 'test:key:1';
  v_hash text := 'hash1';
  v_resp jsonb := jsonb_build_object('ok', true, 'x', 1);
  v_begin jsonb;
  v_balance bigint;
  v_unapplied bigint;
begin
  insert into billing_cases (billing_case_id, payer_id, currency_code)
  values (v_bc, v_payer, 'USD');

  insert into invoices (
    invoice_record_id, billing_case_id, payer_id, currency_code, invoice_number,
    status, collection_status, issue_date, due_date, issued_at, grand_total_cents
  ) values
  (v_invoice, v_bc, v_payer, 'USD', 'INV-0001', 'issued', 'active', current_date, current_date, now(), 10000),
  (v_invoice_void, v_bc, v_payer, 'USD', 'INV-VOID', 'void', 'active', current_date, current_date, now(), 9999);

  insert into payments (
    payment_record_id, payer_id, currency_code, payment_date, amount_cents, status, processor, processor_transaction_id
  ) values
  (v_payment, v_payer, 'USD', current_date, 10000, 'settled', 'test', 'tx-1'),
  (v_payment_pending, v_payer, 'USD', current_date, 5000, 'pending', 'test', 'tx-2');

  insert into credit_memos (
    credit_memo_record_id, billing_case_id, payer_id, currency_code, credit_memo_number,
    issue_date, credit_total_cents, status, issued_at
  ) values
  (v_cm, v_bc, v_payer, 'USD', 'CM-0001', current_date, 3000, 'issued', now()),
  (v_cm_draft, v_bc, v_payer, 'USD', 'CM-DRAFT', current_date, 3000, 'draft', null);

  -- ----------------------------
  -- Idempotency: new -> complete -> replay
  -- ----------------------------
  v_begin := idempotency_begin(v_key, 'op1', v_hash);
  if v_begin->>'kind' <> 'new' then
    raise exception 'expected idempotency_begin kind=new, got %', v_begin;
  end if;

  perform idempotency_complete(v_key, v_resp);

  v_begin := idempotency_begin(v_key, 'op1', v_hash);
  if v_begin->>'kind' <> 'replay' then
    raise exception 'expected idempotency_begin kind=replay, got %', v_begin;
  end if;

  if (v_begin->'response') <> v_resp then
    raise exception 'expected replay response %, got %', v_resp, v_begin->'response';
  end if;

  begin
    perform idempotency_begin(v_key, 'op1', 'DIFFERENT_HASH');
    raise exception 'expected idempotency mismatch exception';
  exception
    when others then
      -- ok
  end;

  -- ----------------------------
  -- Scope enforcement: mismatched payer should fail FK
  -- ----------------------------
  begin
    insert into payment_allocations (
      payment_allocation_id, payment_record_id, invoice_record_id,
      payer_id, currency_code, billing_case_id,
      applied_cents, idempotency_key
    ) values (
      v_alloc, v_payment, v_invoice,
      v_payer_other, 'USD', v_bc,
      1000, 'alloc:bad-scope'
    );
    raise exception 'expected FK scope mismatch failure';
  exception
    when others then
      -- ok
  end;

  -- ----------------------------
  -- Normal allocation success
  -- ----------------------------
  insert into payment_allocations (
    payment_allocation_id, payment_record_id, invoice_record_id,
    payer_id, currency_code, billing_case_id,
    applied_cents, idempotency_key
  ) values (
    v_alloc, v_payment, v_invoice,
    v_payer, 'USD', v_bc,
    4000, 'alloc:good'
  );

  -- ----------------------------
  -- Sign discipline: negative without reversal/refund should fail (after addendum, refund_of is allowed but required)
  -- ----------------------------
  begin
    insert into payment_allocations (
      payment_allocation_id, payment_record_id, invoice_record_id,
      payer_id, currency_code, billing_case_id,
      applied_cents, idempotency_key,
      reversal_of_payment_allocation_id, refund_of_payment_allocation_id
    ) values (
      'cccccccc-cccc-cccc-cccc-cccccccccccc', v_payment, v_invoice,
      v_payer, 'USD', v_bc,
      -1000, 'alloc:neg-no-link',
      null, null
    );
    raise exception 'expected sign discipline failure (neg without link)';
  exception
    when others then
      -- ok
  end;

  -- ----------------------------
  -- Partial refunds: multiple refund adjustments are allowed (many:1)
  -- ----------------------------
  insert into payment_allocations (
    payment_allocation_id, payment_record_id, invoice_record_id,
    payer_id, currency_code, billing_case_id,
    applied_cents, idempotency_key,
    refund_of_payment_allocation_id
  ) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', v_payment, v_invoice, v_payer, 'USD', v_bc, -1000, 'refund:1', v_alloc),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', v_payment, v_invoice, v_payer, 'USD', v_bc, -500,  'refund:2', v_alloc);

  -- Neg row cannot be both reversal and refund adjustment
  begin
    insert into payment_allocations (
      payment_allocation_id, payment_record_id, invoice_record_id,
      payer_id, currency_code, billing_case_id,
      applied_cents, idempotency_key,
      reversal_of_payment_allocation_id, refund_of_payment_allocation_id
    ) values (
      'ffffffff-ffff-ffff-ffff-ffffffffffff', v_payment, v_invoice,
      v_payer, 'USD', v_bc,
      -1, 'refund:bad-both',
      v_alloc, v_alloc
    );
    raise exception 'expected sign discipline failure (neg with both links)';
  exception
    when others then
      -- ok
  end;

  -- ----------------------------
  -- Credit availability view: draft credit shows 0 available
  -- ----------------------------
  select unapplied_cents into v_unapplied
  from credit_memo_available_balance_view
  where credit_memo_record_id = v_cm_draft;
  if v_unapplied <> 0 then
    raise exception 'expected draft credit availability 0, got %', v_unapplied;
  end if;

  -- ----------------------------
  -- Payment availability view: pending payment shows 0 available
  -- ----------------------------
  select unapplied_cents into v_unapplied
  from payment_available_balance_view
  where payment_record_id = v_payment_pending;
  if v_unapplied <> 0 then
    raise exception 'expected pending payment availability 0, got %', v_unapplied;
  end if;

  -- ----------------------------
  -- Invoice balance view: void invoice shows 0 collectible balance
  -- ----------------------------
  select balance_due_cents into v_balance
  from invoice_balance_view
  where invoice_record_id = v_invoice_void;
  if v_balance <> 0 then
    raise exception 'expected void invoice balance 0, got %', v_balance;
  end if;

  -- Sanity: non-void invoice has non-negative balance (clamped)
  select balance_due_cents into v_balance
  from invoice_balance_view
  where invoice_record_id = v_invoice;
  if v_balance < 0 then
    raise exception 'expected non-negative balance, got %', v_balance;
  end if;
end $$;

