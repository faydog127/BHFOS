-- Minimal ledger schema (PostgreSQL) for integration testing the v1 invariants.
-- This is intentionally isolated under tmp/ and is not wired into the main app yet.

create table if not exists billing_cases (
  billing_case_id uuid primary key,
  payer_id uuid not null,
  currency_code char(3) not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_cases_payer_id on billing_cases (payer_id);

create table if not exists invoices (
  invoice_record_id uuid primary key,
  billing_case_id uuid not null references billing_cases(billing_case_id),
  payer_id uuid not null,
  currency_code char(3) not null,
  invoice_number text not null unique,

  status text not null check (status in ('draft','issued','partially_paid','paid','overdue','void')),
  collection_status text not null default 'active' check (collection_status in ('active','disputed','collections','written_off')),

  issue_date date null,
  due_date date null,
  issued_at timestamptz null,

  issuer_snapshot_json jsonb not null default '{}'::jsonb,
  payer_snapshot_json jsonb not null default '{}'::jsonb,

  line_subtotal_cents bigint not null default 0 check (line_subtotal_cents >= 0),
  line_discount_total_cents bigint not null default 0 check (line_discount_total_cents >= 0),
  document_discount_total_cents bigint not null default 0 check (document_discount_total_cents >= 0),
  fee_total_cents bigint not null default 0 check (fee_total_cents >= 0),
  tax_total_cents bigint not null default 0 check (tax_total_cents >= 0),
  grand_total_cents bigint not null default 0 check (grand_total_cents >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (status = 'draft' and issued_at is null)
    or
    (status in ('issued','partially_paid','paid','overdue','void') and issued_at is not null)
  ),

  constraint uq_invoices_scope unique (invoice_record_id, billing_case_id, payer_id, currency_code)
);

create index if not exists idx_invoices_billing_case_id on invoices (billing_case_id);
create index if not exists idx_invoices_payer_id on invoices (payer_id);
create index if not exists idx_invoices_status on invoices (status);
create index if not exists idx_invoices_due_date on invoices (due_date);

create table if not exists payments (
  payment_record_id uuid primary key,
  payer_id uuid not null,
  currency_code char(3) not null,

  payment_date date not null,
  amount_cents bigint not null check (amount_cents > 0),

  status text not null check (status in ('pending','authorized','settled','failed','voided')),

  processor text null,
  processor_transaction_id text null,
  confirmation_number text null,

  created_at timestamptz not null default now(),

  constraint uq_payments_processor_txn unique (processor, processor_transaction_id),
  constraint uq_payments_scope unique (payment_record_id, payer_id, currency_code)
);

create index if not exists idx_payments_payer_id on payments (payer_id);
create index if not exists idx_payments_status on payments (status);
create index if not exists idx_payments_payment_date on payments (payment_date);

create table if not exists payment_allocations (
  payment_allocation_id uuid primary key,

  payment_record_id uuid not null,
  invoice_record_id uuid not null,

  payer_id uuid not null,
  currency_code char(3) not null,
  billing_case_id uuid not null,

  applied_cents bigint not null check (applied_cents <> 0),
  effective_at timestamptz not null default now(),

  idempotency_key text not null unique,
  created_by_user_id uuid null,
  created_at timestamptz not null default now(),

  reversal_of_payment_allocation_id uuid null,

  constraint fk_pa_payment_scope
    foreign key (payment_record_id, payer_id, currency_code)
    references payments(payment_record_id, payer_id, currency_code),

  constraint fk_pa_invoice_scope
    foreign key (invoice_record_id, billing_case_id, payer_id, currency_code)
    references invoices(invoice_record_id, billing_case_id, payer_id, currency_code),

  constraint fk_pa_reversal
    foreign key (reversal_of_payment_allocation_id)
    references payment_allocations(payment_allocation_id),

  constraint ck_pa_no_self_reversal check (
    reversal_of_payment_allocation_id is null
    or reversal_of_payment_allocation_id <> payment_allocation_id
  ),

  constraint ck_pa_sign_discipline check (
    (applied_cents > 0 and reversal_of_payment_allocation_id is null)
    or
    (applied_cents < 0 and reversal_of_payment_allocation_id is not null)
  )
);

create unique index if not exists uq_pa_one_reversal_per_row
  on payment_allocations (reversal_of_payment_allocation_id)
  where reversal_of_payment_allocation_id is not null;

create index if not exists idx_payment_allocations_payment_record_id on payment_allocations (payment_record_id);
create index if not exists idx_payment_allocations_invoice_record_id on payment_allocations (invoice_record_id);
create index if not exists idx_payment_allocations_effective_at on payment_allocations (effective_at);

create table if not exists payment_refunds (
  refund_id uuid primary key,
  payment_record_id uuid not null references payments(payment_record_id),

  refund_amount_cents bigint not null check (refund_amount_cents > 0),
  status text not null check (status in ('pending','settled','failed','voided')),

  processor_refund_id text null,
  refunded_at timestamptz null,
  created_at timestamptz not null default now(),

  constraint uq_payment_refunds_processor_refund unique (processor_refund_id)
);

create index if not exists idx_payment_refunds_payment_record_id on payment_refunds (payment_record_id);
create index if not exists idx_payment_refunds_status on payment_refunds (status);

create table if not exists credit_memos (
  credit_memo_record_id uuid primary key,
  billing_case_id uuid not null references billing_cases(billing_case_id),
  payer_id uuid not null,
  currency_code char(3) not null,
  credit_memo_number text not null unique,

  issue_date date not null,
  credit_total_cents bigint not null check (credit_total_cents > 0),

  status text not null check (status in ('draft','issued','void')),
  issued_at timestamptz null,

  tax_reversal_snapshot_json jsonb null,
  created_at timestamptz not null default now(),

  check (
    (status = 'draft' and issued_at is null)
    or (status = 'issued' and issued_at is not null)
    or (status = 'void')
  ),

  constraint uq_credit_memos_scope unique (credit_memo_record_id, billing_case_id, payer_id, currency_code)
);

create index if not exists idx_credit_memos_billing_case_id on credit_memos (billing_case_id);
create index if not exists idx_credit_memos_payer_id on credit_memos (payer_id);
create index if not exists idx_credit_memos_status on credit_memos (status);

create table if not exists credit_applications (
  credit_application_id uuid primary key,

  credit_memo_record_id uuid not null,
  invoice_record_id uuid not null,

  payer_id uuid not null,
  currency_code char(3) not null,
  billing_case_id uuid not null,

  applied_cents bigint not null check (applied_cents <> 0),
  effective_at timestamptz not null default now(),

  idempotency_key text not null unique,
  created_by_user_id uuid null,
  created_at timestamptz not null default now(),

  reversal_of_credit_application_id uuid null,

  constraint fk_ca_credit_memo_scope
    foreign key (credit_memo_record_id, billing_case_id, payer_id, currency_code)
    references credit_memos(credit_memo_record_id, billing_case_id, payer_id, currency_code),

  constraint fk_ca_invoice_scope
    foreign key (invoice_record_id, billing_case_id, payer_id, currency_code)
    references invoices(invoice_record_id, billing_case_id, payer_id, currency_code),

  constraint fk_ca_reversal
    foreign key (reversal_of_credit_application_id)
    references credit_applications(credit_application_id),

  constraint ck_ca_no_self_reversal check (
    reversal_of_credit_application_id is null
    or reversal_of_credit_application_id <> credit_application_id
  ),

  constraint ck_ca_sign_discipline check (
    (applied_cents > 0 and reversal_of_credit_application_id is null)
    or
    (applied_cents < 0 and reversal_of_credit_application_id is not null)
  )
);

create unique index if not exists uq_ca_one_reversal_per_row
  on credit_applications (reversal_of_credit_application_id)
  where reversal_of_credit_application_id is not null;

create index if not exists idx_credit_applications_credit_memo_record_id on credit_applications (credit_memo_record_id);
create index if not exists idx_credit_applications_invoice_record_id on credit_applications (invoice_record_id);
create index if not exists idx_credit_applications_effective_at on credit_applications (effective_at);

create table if not exists invoice_writeoffs (
  writeoff_id uuid primary key,
  invoice_record_id uuid not null references invoices(invoice_record_id),

  applied_cents bigint not null check (applied_cents <> 0),
  reason_code text not null,
  effective_at timestamptz not null default now(),

  created_by_user_id uuid null,
  created_at timestamptz not null default now(),

  idempotency_key text not null unique,

  reversal_of_writeoff_id uuid null references invoice_writeoffs(writeoff_id),

  check (
    reversal_of_writeoff_id is null
    or reversal_of_writeoff_id <> writeoff_id
  ),

  constraint ck_iw_sign_discipline check (
    (applied_cents > 0 and reversal_of_writeoff_id is null)
    or
    (applied_cents < 0 and reversal_of_writeoff_id is not null)
  )
);

create unique index if not exists uq_iw_one_reversal_per_row
  on invoice_writeoffs (reversal_of_writeoff_id)
  where reversal_of_writeoff_id is not null;

create index if not exists idx_invoice_writeoffs_invoice_record_id on invoice_writeoffs (invoice_record_id);
create index if not exists idx_invoice_writeoffs_effective_at on invoice_writeoffs (effective_at);

