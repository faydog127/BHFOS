# P0-02 Transaction Model

**Status:** REVIEWED AND LOCKED FOR IMPLEMENTATION PLANNING  
**Phase:** P0-02.A — Transaction Model Lock

---

## 1. Objective

Establish a ledger-first payment architecture that prevents duplicate financial effects, removes invoice mutation as the accounting source of truth, and forces all payment writers through a shared settlement path.

This model defines:
- the **data model** for payment attempts, transactions, and transaction applications
- the **writer contract** for public, webhook, manual, and mock payment flows
- the **settlement contract** that derives invoice payment state from the ledger

---

## 2. Financial Truth Invariant

### Invariant
Financial truth is defined by the transaction ledger.

### Locked Rules
- Every real financial effect is recorded as an immutable transaction.
- Invoice paid state is a derived settlement view, not primary accounting truth.
- Duplicate intake may create or resolve to an attempt record, but must not create a second financial effect.
- No payment writer may bypass the transaction-first ledger path.

### Failure Conditions
- Any authoritative additive mutation such as `amount_paid = amount_paid + x`
- Any durable payment effect without a stable dedupe reference
- Any divergence between invoice settlement state and ledger-derived totals
- Any writer-specific settlement behavior that bypasses the shared settlement path

### Detection
- replay tests
- reconciliation queries
- writer inventory audit
- additive mutation scan

---

## 3. Canonical Accounting Rule

> The transaction ledger is the financial source of truth.  
> The invoice is a derived settlement view.

This means:
- payment truth lives in ledger tables
- invoice paid/unpaid state is derived
- writers do not directly invent invoice settlement truth
- retries and replays must not create duplicate financial effects

---

## 4. Approved Writers

| Mode | Allowed Writer | Path |
|---|---|---|
| Public payment | `public-pay` | `supabase/functions/public-pay/index.ts` |
| Webhook | `payment-webhook` | `supabase/functions/payment-webhook/index.ts` |
| Manual / offline | `invoice-update-status` | `supabase/functions/invoice-update-status/index.ts` |
| Local / dev | `mock` | dev only |

### Writer Rule
Each writer owns only its mode and must still follow the same ledger-first contract.

---

## 5. Locked Writer Rules

All writers must:
- use a stable idempotency key or reference
- write to ledger first
- avoid direct invoice mutation as accounting truth
- use shared settlement logic
- return existing transaction on duplicate
- avoid second financial effect on replay

All writers must also:
- use database-enforced uniqueness, not app-only dedupe
- follow the canonical duplicate response contract
- emit canonical payment events only through the approved event rule

---

## 6. Coverage Boundary

### In Scope
- `supabase/functions/public-pay/index.ts`
- `supabase/functions/payment-webhook/index.ts`
- `supabase/functions/invoice-update-status/index.ts`
- SQL / RPC payment mutation paths
- transaction / receipt / event emission logic
- internal/manual tooling that records payment state

### Not Yet in Scope
- refunds
- chargebacks
- reversals
- voids
- accounting export systems

### Constraint
Deferred cases above must not be implemented ad hoc while P0-02 is being stabilized.

---

## 7. Schema Specification

### 7.1 Enums

```sql
create type payment_writer_mode as enum (
  'public_pay',
  'webhook',
  'manual',
  'mock'
);

create type payment_provider_name as enum (
  'stripe',
  'manual',
  'mock'
);

create type payment_attempt_status as enum (
  'received',
  'duplicate',
  'resolved',
  'rejected',
  'failed'
);

create type transaction_type as enum (
  'payment',
  'refund',
  'adjustment',
  'credit'
);

create type transaction_status as enum (
  'pending',
  'succeeded',
  'failed',
  'voided',
  'refunded',
  'partially_refunded'
);

create type transaction_application_type as enum (
  'payment',
  'refund_reversal',
  'credit_application',
  'adjustment'
);

create type invoice_settlement_status as enum (
  'unpaid',
  'partial',
  'paid',
  'overpaid'
);
```

---

### 7.2 Invoice Table Changes

#### Required invoice field
```sql
alter table public.invoices
  add column if not exists date_of_service date;
```

#### Derived settlement fields
```sql
alter table public.invoices
  add column if not exists amount_paid bigint not null default 0;

alter table public.invoices
  add column if not exists amount_due bigint;

alter table public.invoices
  add column if not exists settlement_status invoice_settlement_status not null default 'unpaid';

alter table public.invoices
  add column if not exists last_payment_at timestamptz;
```

#### Initial backfill
```sql
update public.invoices
set amount_due = total_amount
where amount_due is null;
```

```sql
alter table public.invoices
  alter column amount_due set not null;
```

#### Invoice constraints
```sql
alter table public.invoices
  add constraint invoices_amount_paid_nonnegative
  check (amount_paid >= 0);

alter table public.invoices
  add constraint invoices_amount_due_nonnegative
  check (amount_due >= 0);
```

#### Invoice rule
`amount_paid`, `amount_due`, `settlement_status`, and `last_payment_at` are derived settlement fields. They may only be updated through shared settlement logic.

#### Current-stage simplification note
`date_of_service` is a current-stage simplification. If future multi-visit or staged work requires more than one service date, that expansion must be designed explicitly rather than improvised.

---

### 7.3 Table: `payment_attempts`

Purpose: capture incoming payment write attempts, retries, and replay diagnostics.

```sql
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),

  writer_mode payment_writer_mode not null,
  invoice_id uuid null references public.invoices(id) on delete set null,

  idempotency_key text not null,
  provider_name payment_provider_name not null,
  provider_event_id text null,
  provider_object_id text null,
  manual_reference text null,

  request_payload jsonb not null default '{}'::jsonb,
  attempt_status payment_attempt_status not null default 'received',

  resolved_transaction_id uuid null,
  created_by_user_id uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_attempts_manual_reference_required
    check (
      writer_mode <> 'manual'
      or manual_reference is not null
    )
);
```

---

### 7.4 Table: `transactions`

Purpose: canonical ledger of real economic events.

```sql
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),

  transaction_type transaction_type not null,
  transaction_status transaction_status not null default 'pending',

  invoice_id uuid not null references public.invoices(id) on delete restrict,

  writer_mode payment_writer_mode not null,
  provider_name payment_provider_name not null,

  currency text not null default 'usd',

  gross_amount bigint not null,
  applied_amount bigint not null default 0,
  unapplied_amount bigint not null default 0,

  fee_amount bigint null,
  net_amount bigint null,

  idempotency_key text not null,
  provider_event_id text null,
  provider_object_id text null,
  manual_reference text null,

  recorded_at timestamptz not null default now(),
  effective_at timestamptz not null default now(),

  created_by_user_id uuid null references auth.users(id) on delete set null,
  supersedes_transaction_id uuid null references public.transactions(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint transactions_gross_amount_nonnegative
    check (gross_amount >= 0),

  constraint transactions_applied_amount_nonnegative
    check (applied_amount >= 0),

  constraint transactions_unapplied_amount_nonnegative
    check (unapplied_amount >= 0),

  constraint transactions_amount_balance_check
    check (applied_amount + unapplied_amount = gross_amount),

  constraint transactions_manual_reference_required
    check (
      writer_mode <> 'manual'
      or manual_reference is not null
    )
);
```

---

### 7.5 Table: `transaction_applications`

Purpose: record exactly how successful transactions affect invoice balance.

```sql
create table if not exists public.transaction_applications (
  id uuid primary key default gen_random_uuid(),

  transaction_id uuid not null references public.transactions(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,

  applied_amount bigint not null,
  application_type transaction_application_type not null default 'payment',

  created_by_user_id uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,

  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint transaction_applications_positive_amount
    check (applied_amount > 0)
);
```

---

### 7.6 Foreign Key Completion

```sql
alter table public.payment_attempts
  add constraint payment_attempts_resolved_transaction_fk
  foreign key (resolved_transaction_id)
  references public.transactions(id)
  on delete set null;
```

---

### 7.7 Unique Indexes

#### Attempt-level idempotency
```sql
create unique index if not exists ux_payment_attempts_writer_idempotency
  on public.payment_attempts (writer_mode, idempotency_key);
```

#### Webhook delivery replay protection
```sql
create unique index if not exists ux_payment_attempts_provider_event_id
  on public.payment_attempts (provider_name, provider_event_id)
  where provider_event_id is not null;
```

#### Transaction-level idempotency
```sql
create unique index if not exists ux_transactions_writer_idempotency
  on public.transactions (writer_mode, idempotency_key);
```

#### Provider economic-object uniqueness
```sql
create unique index if not exists ux_transactions_provider_object_type
  on public.transactions (provider_name, provider_object_id, transaction_type)
  where provider_object_id is not null;
```

#### Manual-payment uniqueness
```sql
create unique index if not exists ux_transactions_invoice_manual_reference
  on public.transactions (invoice_id, manual_reference)
  where manual_reference is not null;
```

---

### 7.8 Supporting Indexes

```sql
create index if not exists ix_payment_attempts_invoice_id
  on public.payment_attempts (invoice_id);

create index if not exists ix_payment_attempts_created_at
  on public.payment_attempts (created_at desc);

create index if not exists ix_transactions_invoice_id
  on public.transactions (invoice_id);

create index if not exists ix_transactions_status
  on public.transactions (transaction_status);

create index if not exists ix_transactions_recorded_at
  on public.transactions (recorded_at desc);

create index if not exists ix_transaction_applications_invoice_id
  on public.transaction_applications (invoice_id);

create index if not exists ix_transaction_applications_transaction_id
  on public.transaction_applications (transaction_id);
```

---

## 8. Settlement and Writer Contract

### 8.1 Required Shared Function Boundary

A single settlement boundary must exist.

#### Canonical function
```text
recalculate_invoice_settlement(invoice_id uuid)
```

#### Responsibilities
This function must:
- read succeeded transaction applications for the invoice
- calculate `amount_paid`
- calculate `amount_due`
- set `settlement_status`
- set `last_payment_at`

#### Derived status rules
- `unpaid` → `amount_paid = 0`
- `partial` → `0 < amount_paid < total_amount`
- `paid` → `amount_paid = total_amount`
- `overpaid` → `amount_paid > total_amount`

#### Stored-field update rule
Only this shared settlement path may write:
- `invoices.amount_paid`
- `invoices.amount_due`
- `invoices.settlement_status`
- `invoices.last_payment_at`

---

### 8.2 Financial Invariants

#### Invariant 1
One real economic event maps to one canonical transaction row.

#### Invariant 2
A duplicate intake may create or resolve to a `payment_attempts` record, but must not create a second transaction.

#### Invariant 3
Only `transactions.transaction_status = 'succeeded'` may create invoice settlement effect.

#### Invariant 4
Invoice settlement must derive from `transaction_applications`, not direct writer mutation.

#### Invariant 5
Refunds do not mutate original payment history. They create new reversing transactions.

#### Invariant 6
Manual payments require a valid, non-null, high-signal reference.

#### Invariant 7
Webhook replay must not create a second succeeded transaction for the same provider object.

---

### 8.3 Idempotency Keys by Writer

#### Public pay
Preferred:
- server-issued payment session key, or
- provider payment object ID if created server-side

Do not use:
- timestamps
- click events
- raw request hashes

#### Webhook
Use two layers:
- **delivery dedupe:** `provider_event_id`
- **economic dedupe:** `provider_object_id`

Webhook event ID alone is not enough.

#### Manual / offline
Use a required staff-provided reference such as:
- check number
- ACH confirmation
- wire confirmation
- receipt number
- generated internal receipt number

Invalid manual references include low-signal placeholders such as:
- `cash`
- `paid`
- `manual`
- blank-like placeholders

#### Mock / local
Use deterministic dev keys, for example:
- `mock:{invoice_id}:{scenario}:{sequence}`

---

### 8.4 Provider Economic Object Freeze

For Stripe-like providers, `provider_object_id` for real payment uniqueness shall be the **Stripe Payment Intent ID** unless a different provider-specific standard is formally documented.

Checkout session IDs are not the canonical economic uniqueness primitive unless settlement is explicitly modeled at that layer.

---

### 8.5 Canonical Write Order

All writers must follow this sequence:
1. Validate input and confirm mode ownership
2. Resolve idempotency key or reference
3. Attempt to record `payment_attempts` row
4. Check for existing transaction using idempotency and provider/object rules
5. If duplicate:
   - return existing transaction
   - do not create new financial effect
6. If new:
   - create canonical transaction row
7. If succeeded transaction should affect invoice:
   - create `transaction_applications` row
8. Call shared settlement logic
9. Emit canonical payment event if applicable
10. Return response payload

---

### 8.6 Duplicate Handling

#### Required behavior
If duplicate payment is detected:
- return existing transaction
- do not create second transaction
- do not create second `transaction_application`
- do not reapply settlement as a new payment
- do not emit second canonical `PaymentRecorded` event

#### Duplicate response contract
```json
{
  "ok": true,
  "duplicate": true,
  "transaction_id": "<existing_transaction_id>",
  "financial_effect_created": false,
  "event_emitted": false
}
```

Expanded form is allowed if needed:
```json
{
  "ok": true,
  "duplicate": true,
  "transaction": {
    "id": "<existing_transaction_id>",
    "status": "succeeded",
    "amount": 12500,
    "currency": "usd"
  },
  "financial_effect_created": false,
  "event_emitted": false
}
```

---

### 8.7 Event Rule

There may be only one canonical `PaymentRecorded` event per real transaction.

#### Replay behavior
On replay or duplicate:
- emit no event, or
- emit a clearly marked duplicate/replay event

Never emit a second canonical `PaymentRecorded` event for the same underlying transaction.

#### Event durability note
Implementation must not rely on best-effort event emission. Event creation must have a deterministic recovery path if transaction commit succeeds and event dispatch fails.

---

### 8.8 Writer-Specific Contracts

#### `public-pay`
Responsibilities:
- validate public token/session
- resolve invoice
- use stable public idempotency key
- create or resolve canonical transaction
- apply successful payment through ledger and settlement path

`public-pay` may not directly mark invoice paid.

#### `payment-webhook`
Responsibilities:
- verify provider signature
- dedupe delivery by `provider_event_id`
- dedupe economic event by `provider_object_id`
- resolve invoice and canonical transaction
- apply only when event reflects real succeeded economic state

`payment-webhook` may not create duplicate financial effect if `public-pay` already recorded the same payment object.

#### `invoice-update-status`
Responsibilities:
- require authenticated internal actor
- require valid manual reference
- create canonical manual transaction
- apply settlement through same shared logic

This writer must stop being a direct invoice-state mutator and become a ledger writer.

#### `mock`
Responsibilities:
- dev-only deterministic writes
- explicit mock references
- must not be enabled in production

---

### 8.9 Transaction Status Transition Rule

- `public-pay` may create `pending` or `succeeded` transactions depending on whether the provider flow is synchronous.
- `payment-webhook` may resolve previously pending transactions to `succeeded`, `failed`, or refund-related states.
- Settlement application occurs only once, upon first settlement-eligible success.

---

### 8.10 Concurrency Rule

Concurrent delivery is assumed possible.

Examples:
- public-pay and webhook race
- webhook retry storm
- manual user double-submits

#### Required protection
Concurrency protection must rely on database uniqueness and conflict handling, not only pre-insert reads.

Implementation must use:
- unique indexes
- transactional insert-or-return patterns
- conflict-aware write handling

App-side “check then insert” alone is insufficient.

---

### 8.11 Settlement Application Rule

A `transaction_application` may be created only when:
- transaction is canonical
- transaction is not duplicate
- transaction is in a settlement-eligible state, normally `succeeded`

No application row should be created for failed or duplicate non-effects.

---

## 9. Migration and Legacy Handling

### Legacy Backfill Requirement
Before cutover, existing invoices with historical paid status must be reviewed and either:
- backfilled into ledger records, or
- explicitly marked as legacy non-ledger records pending administrative cleanup

Do not mix pre-ledger paid invoices with post-ledger assumptions silently.

### Migration Constraint
No cutover without:
- mutation-path inventory
- historical comparison/reconciliation plan
- staged rollout and backfill plan
- rollback-safe validation window

### Direct-Mutation Governance
No payment writer may directly update invoice settlement fields except through the shared settlement path. Any remaining legacy direct-update code must be removed or deprecated during patching.

---

## 10. Reconciliation Requirement

This model protects writes and must also support drift detection.

Required capability:
- compare provider records to internal ledger
- compare ledger to invoice projection state
- detect and repair drift deliberately, not ad hoc

Provider reconciliation implementation may be deferred, but the system must be designed so it can be added without redefining financial truth.

---

## 11. Implementation Checklist

### Schema
- add `date_of_service` to invoices
- add derived settlement fields to invoices
- create enums
- create `payment_attempts`
- create `transactions`
- create `transaction_applications`
- add foreign keys
- add unique indexes
- add supporting indexes

### Logic
- implement `recalculate_invoice_settlement(invoice_id)`
- refactor `public-pay` to ledger-first
- refactor `payment-webhook` to ledger-first
- refactor `invoice-update-status` to ledger-first
- standardize duplicate response payload
- standardize canonical event rule

---

## 12. Review Outcome

### Strengths locked in
- ledger-first truth is explicit
- duplicate prevention exists at both attempt and transaction layers
- manual payment is no longer a loose invoice toggle
- service date is added to invoices
- provider object uniqueness is frozen
- manual reference quality is tightened
- concurrency is treated as a first-class risk

### Risks explicitly acknowledged
- event durability needs deterministic implementation
- historical legacy invoice states require backfill or explicit legacy treatment
- direct invoice mutation must be eliminated during patching
- provider reconciliation remains a later implementation layer, not a reason to keep mutable accounting truth

---

## 13. Final Recommendation

This transaction model is implementation-grade for planning and patch design.

The next step is:
- turn this into a repo-ready patch checklist and migration plan
- then patch the first writer boundary (`invoice-update-status`) under P0-02 using this model

---

## 14. Status

- Classification: REVIEWED / READY_FOR_PATCH_PLANNING
- Readiness: CONDITIONALLY_READY

