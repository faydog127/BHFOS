-- Database-enforced invariant tests: explicit constraint break attempts.
-- Run with: psql -v ON_ERROR_STOP=1 -f /work/tests/003_constraints.sql

do $$
declare
  bc1 uuid := '10101010-1010-1010-1010-101010101010';
  bc2 uuid := '20202020-2020-2020-2020-202020202020';
  payer uuid := '30303030-3030-3030-3030-303030303030';
  inv_usd uuid := '40404040-4040-4040-4040-404040404040';
  inv_eur uuid := '50505050-5050-5050-5050-505050505050';
  inv_other_case uuid := '60606060-6060-6060-6060-606060606060';
  pay_usd uuid := '70707070-7070-7070-7070-707070707070';
  cm1 uuid := '80808080-8080-8080-8080-808080808080';
  alloc1 uuid := '90909090-9090-9090-9090-909090909090';
begin
  insert into billing_cases (billing_case_id, payer_id, currency_code) values
    (bc1, payer, 'USD'),
    (bc2, payer, 'USD');

  insert into invoices (
    invoice_record_id, billing_case_id, payer_id, currency_code, invoice_number,
    status, collection_status, issue_date, due_date, issued_at, grand_total_cents
  ) values
    (inv_usd, bc1, payer, 'USD', 'INV-C-USD', 'issued', 'active', current_date, current_date, now(), 10000),
    (inv_eur, bc1, payer, 'EUR', 'INV-C-EUR', 'issued', 'active', current_date, current_date, now(), 10000),
    (inv_other_case, bc2, payer, 'USD', 'INV-C-BC2', 'issued', 'active', current_date, current_date, now(), 10000);

  insert into payments (payment_record_id, payer_id, currency_code, payment_date, amount_cents, status, processor, processor_transaction_id)
  values (pay_usd, payer, 'USD', current_date, 10000, 'settled', 'test', 'tx-constraints');

  insert into credit_memos (
    credit_memo_record_id, billing_case_id, payer_id, currency_code, credit_memo_number,
    issue_date, credit_total_cents, status, issued_at
  ) values (cm1, bc1, payer, 'USD', 'CM-C-1', current_date, 1000, 'issued', now());

  -- Cross-currency allocation should fail via composite FK (invoice scope is EUR, payment scope is USD).
  begin
    insert into payment_allocations (
      payment_allocation_id, payment_record_id, invoice_record_id,
      payer_id, currency_code, billing_case_id,
      applied_cents, idempotency_key
    ) values (
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', pay_usd, inv_eur,
      payer, 'EUR', bc1,
      1, 'alloc:cross-currency'
    );
    raise exception 'expected cross-currency allocation to fail';
  exception when others then end;

  -- Cross-billing-case credit application should fail (invoice bc2, credit memo bc1).
  begin
    insert into credit_applications (
      credit_application_id, credit_memo_record_id, invoice_record_id,
      payer_id, currency_code, billing_case_id,
      applied_cents, idempotency_key
    ) values (
      'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', cm1, inv_other_case,
      payer, 'USD', bc2,
      1, 'credit:cross-billing-case'
    );
    raise exception 'expected cross-billing-case credit app to fail';
  exception when others then end;

  -- Duplicate reversal should fail (partial unique index on reversal_of_payment_allocation_id).
  insert into payment_allocations (
    payment_allocation_id, payment_record_id, invoice_record_id,
    payer_id, currency_code, billing_case_id,
    applied_cents, idempotency_key
  ) values (
    alloc1, pay_usd, inv_usd,
    payer, 'USD', bc1,
    100, 'alloc:base'
  );

  insert into payment_allocations (
    payment_allocation_id, payment_record_id, invoice_record_id,
    payer_id, currency_code, billing_case_id,
    applied_cents, idempotency_key,
    reversal_of_payment_allocation_id
  ) values (
    'cccccccc-dddd-eeee-ffff-000000000000', pay_usd, inv_usd,
    payer, 'USD', bc1,
    -100, 'alloc:reversal-1',
    alloc1
  );

  begin
    insert into payment_allocations (
      payment_allocation_id, payment_record_id, invoice_record_id,
      payer_id, currency_code, billing_case_id,
      applied_cents, idempotency_key,
      reversal_of_payment_allocation_id
    ) values (
      'dddddddd-eeee-ffff-0000-111111111111', pay_usd, inv_usd,
      payer, 'USD', bc1,
      -100, 'alloc:reversal-2',
      alloc1
    );
    raise exception 'expected duplicate reversal to fail';
  exception when others then end;

  -- Issued invoice immutability should fail after trigger is installed.
  begin
    update invoices set grand_total_cents = grand_total_cents + 1 where invoice_record_id = inv_usd;
    raise exception 'expected immutability update to fail';
  exception when others then end;
end $$;

