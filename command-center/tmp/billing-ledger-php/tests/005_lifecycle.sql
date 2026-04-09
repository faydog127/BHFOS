-- Ledger lifecycle sequence tests (multi-step).
-- Run with: psql -v ON_ERROR_STOP=1 -f /work/tests/005_lifecycle.sql

do $$
declare
  bc uuid := '12121212-1212-1212-1212-121212121212';
  payer uuid := '13131313-1313-1313-1313-131313131313';
  inv1 uuid := '14141414-1414-1414-1414-141414141414';
  inv2 uuid := '15151515-1515-1515-1515-151515151515';
  pay uuid := '16161616-1616-1616-1616-161616161616';
  alloc1 uuid := '17171717-1717-1717-1717-171717171717';
  alloc2 uuid := '18181818-1818-1818-1818-181818181818';
  bal bigint;
  avail bigint;
begin
  insert into billing_cases (billing_case_id, payer_id, currency_code) values (bc, payer, 'USD');

  insert into invoices (invoice_record_id, billing_case_id, payer_id, currency_code, invoice_number, status, collection_status, issue_date, due_date, issued_at, grand_total_cents)
  values
    (inv1, bc, payer, 'USD', 'INV-L-1', 'issued', 'active', current_date, current_date, now(), 10000),
    (inv2, bc, payer, 'USD', 'INV-L-2', 'issued', 'active', current_date, current_date, now(), 8000);

  insert into payments (payment_record_id, payer_id, currency_code, payment_date, amount_cents, status, processor, processor_transaction_id)
  values (pay, payer, 'USD', current_date, 15000, 'settled', 'test', 'tx-lifecycle');

  -- Apply payment across multiple invoices.
  insert into payment_allocations (payment_allocation_id, payment_record_id, invoice_record_id, payer_id, currency_code, billing_case_id, applied_cents, idempotency_key)
  values
    (alloc1, pay, inv1, payer, 'USD', bc, 7000, 'lifecycle:alloc1'),
    (alloc2, pay, inv2, payer, 'USD', bc, 6000, 'lifecycle:alloc2');

  select balance_due_cents into bal from invoice_balance_view where invoice_record_id = inv1;
  if bal <> 3000 then raise exception 'expected inv1 balance 3000, got %', bal; end if;

  select balance_due_cents into bal from invoice_balance_view where invoice_record_id = inv2;
  if bal <> 2000 then raise exception 'expected inv2 balance 2000, got %', bal; end if;

  select unapplied_cents into avail from payment_available_balance_view where payment_record_id = pay;
  if avail <> 2000 then raise exception 'expected payment available 2000, got %', avail; end if;

  -- Partial refund #1 against inv1 allocation (1000).
  insert into payment_refunds (refund_id, payment_record_id, refund_amount_cents, status, processor_refund_id, refunded_at)
  values ('19191919-1919-1919-1919-191919191919', pay, 1000, 'settled', 'rf-1', now());

  insert into payment_allocations (payment_allocation_id, payment_record_id, invoice_record_id, payer_id, currency_code, billing_case_id, applied_cents, idempotency_key, refund_of_payment_allocation_id)
  values ('1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a', pay, inv1, payer, 'USD', bc, -1000, 'lifecycle:refund1', alloc1);

  -- Partial refund #2 against same allocation (500).
  insert into payment_refunds (refund_id, payment_record_id, refund_amount_cents, status, processor_refund_id, refunded_at)
  values ('1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b', pay, 500, 'settled', 'rf-2', now());

  insert into payment_allocations (payment_allocation_id, payment_record_id, invoice_record_id, payer_id, currency_code, billing_case_id, applied_cents, idempotency_key, refund_of_payment_allocation_id)
  values ('1c1c1c1c-1c1c-1c1c-1c1c-1c1c1c1c1c1c', pay, inv1, payer, 'USD', bc, -500, 'lifecycle:refund2', alloc1);

  -- Invoice balance increases by 1500 total refunds.
  select balance_due_cents into bal from invoice_balance_view where invoice_record_id = inv1;
  if bal <> 4500 then raise exception 'expected inv1 balance 4500 after refunds, got %', bal; end if;

  -- Payment availability: original 15000 - settled refunds 1500 - net applied (7000-1500 + 6000) = 15000-1500-11500 = 2000
  select unapplied_cents into avail from payment_available_balance_view where payment_record_id = pay;
  if avail <> 2000 then raise exception 'expected payment available still 2000, got %', avail; end if;
end $$;

