# ENTITY OWNERSHIP AND MUTATION RULES (v1)

Purpose: lock **who is allowed to mutate what**, so we prevent shadow logic, vocabulary drift, unsafe direct writes, and tenant boundary failures.

This document is a **Level 2 Protocol** companion to `STATUS_CONTRACTS.md`. If an entity mutation path is not listed here, it is **not** an authorized mutation path.

---

## Definitions

- **Entity owner**: the single authoritative mutation surface for an entity (usually an edge function or DB transition function/trigger).
- **Raw update**: direct PostgREST `UPDATE`/`UPSERT`/`DELETE` to a base table (for example via `supabase.from('jobs').update(...)`) that is not routed through the entity owner.
- **RLS lane**: a request executed under the caller’s JWT and subject to DB RLS policies.
- **Service role lane**: a request executed under `service_role` and capable of bypassing RLS; must enforce boundaries explicitly.

---

## Global Rules (Applies to all entities)

### Rule G1 — Tenant boundary is never client-trusted

- No service-role mutation path may trust any tenant-scoping input from:
  - request body
  - query params
  - headers
  - route params
- Tenant scope must be derived from **verified JWT claims** (or an explicitly documented system actor path with tenant scoping).

### Rule G2 — `service_role` usage is exceptional

`service_role` is allowed only for:
- webhooks (Stripe, email delivery callbacks)
- scheduled/cron automation
- internal reconciliation / backfills

If `service_role` is used:
- the function itself is the security boundary
- every read/write must be tenant-scoped (`eq('tenant_id', tenantId)`)
- any mismatch between claimed tenant and attempted target tenant must hard-fail (403)

### Rule G3 — Status is not arbitrarily assignable

- Status values may only be set via an **authorized transition path** (entity owner).
- UI, scripts, and automations must not directly set status unless they call the authorized owner.

### Rule G4 — Immutable fields are not writable (ever)

Unless explicitly documented per-entity below, the following are immutable:
- `id`
- `tenant_id`
- `created_at`
- public tokens (`public_token`, etc.)
- human identifiers (`quote_number`, `invoice_number`, `work_order_number`) once assigned
- upstream linkage fields once set (`quote_id` on `jobs`, etc.)

### Rule G5 — Raw updates are prohibited for protected fields

Protected fields (minimum set):
- `tenant_id`
- any `*_number` human identifier fields
- `status` fields
- totals and money fields (`subtotal`, `tax_amount`, `total_amount`, `amount_paid`, `balance_due`)

These must not be updated via raw updates. They must be updated only via the entity owner path.

---

## Entity Mutation Matrix (v1)

This section locks:
- who can mutate the entity
- where `service_role` is allowed
- which fields are immutable
- where raw updates are prohibited
- where transition logic is the single authority

### 1) `public.appointments` (Scheduling Source-of-Truth)

**Entity owner (authoritative mutation paths)**
- Create: `supabase/functions/create-appointment/index.ts`
- Status/updates: `supabase/functions/update-appointment-status/index.ts`
- Scheduling mirror updates initiated by work-order operations (only if needed): `supabase/functions/work-order-update/index.ts` (appointments lane only)

**Allowed execution lanes**
- RLS lane: allowed for standard create/update flows (caller JWT, RLS enforced)
- Service role lane: allowed only for automation:
  - reminders/automation: `supabase/functions/run-appointment-reminders/index.ts`

**Immutable fields**
- `id`, `tenant_id`, `created_at`
- `lead_id` (immutable once set unless an explicit reassignment law is introduced)

**Raw updates prohibited**
- Direct `UPDATE` to:
  - `tenant_id`
  - `status` (must go through `update-appointment-status`)
  - `scheduled_start/scheduled_end` (must go through the authorized scheduling owner)

**Transition authority**
- Appointment status changes are owned by `update-appointment-status` (and any DB triggers it invokes).

---

### 2) `public.jobs` (Operational Mirror + Execution Backbone)

**Entity owner (authoritative mutation paths)**
- Work Order lifecycle mutations (schedule/dispatch/start/complete + invariant enforcement):
  - `supabase/functions/work-order-update/index.ts`
- Job creation on quote acceptance:
  - DB trigger/function in migrations (quote acceptance → job creation)
  - public acceptance flow: `supabase/functions/public-quote-approve/index.ts` (if/where used)

**Allowed execution lanes**
- RLS lane: preferred for all job mutations that can be done under caller JWT + RLS
- Service role lane: allowed only for tightly-scoped internal operations inside the entity owner function, if required (must be explicitly tenant-scoped)

**Immutable fields**
- `id`, `tenant_id`, `created_at`
- `quote_id` (immutable once set)
- `work_order_number` (immutable once set)

**Raw updates prohibited**
- Direct `UPDATE` to:
  - `tenant_id`
  - `status` (must go through `work-order-update` transition logic)
  - `scheduled_*`, `technician_id`, `service_address` when the update would result in a dispatchable/scheduled state (must go through `work-order-update` so readiness invariant is enforced)

**Transition authority**
- Job status transitions are owned by `work-order-update` (and any DB triggers it invokes).

---

### 3) `public.quotes` + `public.quote_items` (Binding Quote Contract)

**Entity owner (authoritative mutation paths)**
- Public quote read surface: `supabase/functions/public-quote/index.ts` (read-only)
- Quote send/update status:
  - `supabase/functions/send-estimate/index.ts` (quote delivery)
  - `supabase/functions/quote-update-status/index.ts` (status transitions)
- Quote acceptance:
  - `supabase/functions/public-quote-approve/index.ts` (acceptance flow)
  - DB trigger/function (acceptance → job + optional draft invoice)

**Allowed execution lanes**
- RLS lane: standard authenticated quote operations
- Service role lane: allowed for delivery automation and acceptance orchestration **only if** tenant scope is enforced from verified claims and all mutations are tenant-scoped

**Immutable fields**
- `id`, `tenant_id`, `created_at`
- `public_token`
- `quote_number` (immutable once set)
- `lead_id` (immutable once set unless explicit reassignment law exists)

**Raw updates prohibited**
- Direct edits to:
  - `tenant_id`
  - `status` (must go through quote owner transition path)
  - any money fields on the quote header (`subtotal`, `tax_amount`, `total_amount`) outside the quote-owner calculation path

**Transition authority**
- Quote status transitions are owned by the quote status owner function(s) (see above) and/or DB trigger transitions.

---

### 4) `public.invoices` + `public.invoice_items` (Billing / Money Loop)

**Entity owner (authoritative mutation paths)**
- Draft/save/update invoice:
  - `supabase/functions/invoice-save/index.ts`
- Invoice status transitions:
  - `supabase/functions/invoice-update-status/index.ts`
- Payment settlement / reconciliation:
  - `supabase/functions/payment-webhook/index.ts`
  - `supabase/functions/public-pay/index.ts` (payment initiation / attempt logging)
  - `supabase/functions/stripe-webhook/index.ts` (provider webhook ingress, if used)

**Allowed execution lanes**
- RLS lane: only for narrow, safe read surfaces and tenant-scoped draft operations where explicitly allowed
- Service role lane: expected for webhook settlement and internal reconciliation (must be explicitly tenant-scoped and validate amounts against authoritative totals)

**Immutable fields**
- `id`, `tenant_id`, `created_at`
- `public_token`
- `invoice_number` (immutable once set)
- `job_id` (immutable once set)

**Raw updates prohibited**
- Direct updates to:
  - `status`
  - totals (`subtotal`, `tax_amount`, `total_amount`)
  - settlement fields (`amount_paid`, `balance_due`, `paid_at`, `payment_method`)

**Transition authority**
- Invoice status transitions are owned by:
  - `invoice-update-status` (operator/admin transitions)
  - `payment-webhook` / settlement functions (provider-finalized transitions)

---

### 5) `public.leads` (Intake / Sales Upstream)

**Entity owner (authoritative mutation paths)**
- Lead stage/status updates (if used):
  - `supabase/functions/lead-update-stage/index.ts`
- Kanban workflow (legacy/mixed):
  - `supabase/functions/kanban-move/index.ts`
  - `supabase/functions/kanban-list/index.ts` (read)

**Allowed execution lanes**
- RLS lane: preferred for standard lead operations
- Service role lane: allowed only for narrow system automations where tenant is enforced from verified claims/system actor rules

**Immutable fields**
- `id`, `tenant_id`, `created_at`
- `contact_id`, `property_id` (immutable once set unless reassignment law exists)

**Raw updates prohibited**
- Direct status writes that bypass the lead owner transition path.

**Transition authority**
- Lead status transitions are owned by the lead transition function(s) once aligned; until then, lead status is considered **high drift risk**.

---

## Notes for Review / Enforcement Roadmap (Non-executable)

1. This document locks **ownership**, but does not (by itself) implement DB-level enforcement.
2. Enforcement targets for “Level 1 Law” promotion:
   - constrain status values (enum/check)
   - DB transition functions per entity
   - trigger-based validation
   - append-only transition log
3. Any path that mutates protected fields outside the entity owner must be treated as a bug and routed into a fix packet.

