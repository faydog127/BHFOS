# Phase 0 Remediation Board

## Purpose

Correct the system primitives before behavior cleanup so BHFOS can become a trusted system.

## Rule

Do not start Phase 1 behavior alignment until every Phase 0 item is either VERIFIED or explicitly accepted as open risk.

---

## Execution Order

1. Tenant Isolation Lock
2. Money Model Lock
3. State Machine Authority Lock
4. Unified Commit RPC Lock
5. Phase 1 Behavior Alignment
6. Phase 2 Structural Cleanup

---

## Phase 0 — Foundational Locks

### P0-01 — Tenant Isolation Lock

#### Objective

Remove app-tier tenant trust from public flows and enforce tenant boundary server-side / DB-side.

#### Scope

* `supabase/functions/public-quote/index.ts`
* `supabase/functions/public-invoice/index.ts`
* `supabase/functions/public-pay/index.ts`
* Any public token lookup path
* Relevant RLS / DB policy surfaces

#### Target State

* No `tenant_id` fallback to `tvg`
* No request-supplied tenant decides access by itself
* Tenant derived from authoritative lookup or token binding
* Public endpoints reject missing/mismatched tenant context
* Service-role use minimized and justified

#### Implementation Steps

1. Inventory all public token-based endpoints and current tenant resolution behavior.
2. Remove `tenant_id || 'tvg'` fallback behavior.
3. Refactor token lookup so tenant is derived server-side from token-bearing record.
4. Review whether public endpoints can avoid service-role or must remain tightly scoped.
5. Add explicit mismatch rejection and logging.
6. Add negative tests: correct tenant, missing tenant, wrong tenant, leaked token scenario.
7. Update docs and evidence.

#### Required Artifacts

* Code diff showing fallback removal
* Runtime negative test outputs
* Endpoint behavior matrix
* DB/RLS review notes
* Rollback note

#### PASS

* Wrong/missing tenant cannot silently resolve
* Public token access cannot cross tenant boundary
* Evidence demonstrates rejection behavior and correct behavior

#### Rollback Note

* Keep prior endpoint logic behind a temporary fallback branch only if needed for emergency revert; remove once verified.

---

#### P0-01 IMPLEMENTATION PACKET

##### Immediate Goal

Patch the public document/payment endpoints so tenant resolution is no longer controlled by request input or a default fallback.

##### Files to Inspect First

* `supabase/functions/public-quote/index.ts`
* `supabase/functions/public-invoice/index.ts`
* `supabase/functions/public-pay/index.ts`
* any shared public utility used by those endpoints
* relevant migration/policy files governing quote/invoice public token lookup

##### Problems Already Confirmed

* Public endpoints currently accept `tenant_id` from request and default to `tvg` while using service-role access.
* This creates tenant-isolation risk if a token leaks or if request context is malformed.

##### Required Design Decision for This Fix

Use this rule:

* **tenant is derived from the token-bearing record server-side**
* request-supplied `tenant_id` becomes optional at most for validation, never authority

##### Correct Resolution Pattern

For each public endpoint:

1. Accept the public token.
2. Perform authoritative lookup by token.
3. Read tenant from the located record.
4. If request includes `tenant_id`, it must match derived tenant or the request is rejected.
5. If token not found, reject.
6. If tenant mismatch, reject.
7. Log derived tenant, not fallback tenant.

##### Explicit Non-Goals

* Do not redesign the whole auth model in this step.
* Do not widen service-role use.
* Do not touch unrelated CRM authenticated endpoints yet.
* Do not change payment writer architecture here.

##### Test Matrix (Must Run)

1. **Correct token + no tenant_id**
   * Expected: success using derived tenant
2. **Correct token + correct tenant_id**
   * Expected: success
3. **Correct token + wrong tenant_id**
   * Expected: reject
4. **Correct token + missing tenant_id**
   * Expected: success only if tenant is derived server-side, never via fallback
5. **Invalid token + any tenant_id**
   * Expected: reject
6. **Leaked token simulation**
   * Expected: access limited strictly to token-bound record, no tenant switching

##### Required Output for This Step

* endpoint-by-endpoint behavior matrix before/after
* exact code paths changed
* negative test logs
* evidence note for tracking board
* explicit statement on whether service-role remains and why

##### What Success Looks Like

* No endpoint contains `tenant_id || 'tvg'`
* No public route trusts request tenant as authority
* Wrong tenant input fails hard
* Missing tenant input does not silently select a default tenant
* Logs/events show derived tenant context

##### Stop Conditions

* All three public endpoints patched
* Test matrix completed
* artifacts captured
* tracking board updated

---

### P0-02 — Money Model Lock

#### Objective

Move money truth toward transaction-ledger authority and stop unsafe additive mutation patterns.

#### Scope

* `supabase/functions/invoice-update-status/index.ts`
* `supabase/functions/payment-webhook/index.ts`
* `supabase/functions/public-pay/index.ts`
* transaction tables / invoice totals derivation logic
* any SQL/RPC payment mutation path

#### Target State

* Payments are recorded as durable transaction entries
* Invoice paid/balance state is derived or transaction-backed
* Offline payment path is idempotent
* Replays cannot double-record money

#### Implementation Steps

1. Inventory every payment writer and classify mode: public, webhook, offline, mock.
2. Define canonical transaction model for online and offline settlement.
3. Refactor offline payment path to write immutable transaction with unique idempotency key/reference.
4. Prevent direct additive mutation as final source of truth.
5. Ensure invoice totals are reconciled from transactions or updated through one authoritative routine.
6. Add replay tests for offline and online paths.
7. Add migration plan for any historical data normalization.

#### Required Artifacts

* Payment writer manifest
* Transaction model spec
* Idempotency proof logs
* Replay test outputs
* Migration plan
* Rollback note

#### PASS

* Same payment request cannot mutate money twice
* Transactions remain singular and auditable
* Invoice totals reconcile correctly after replay tests

#### Rollback Note

* Preserve current path only long enough to compare outputs during validation; do not leave dual writers active after cutover.

---

### P0-03 — State Machine Authority Lock

#### Objective

Make one authoritative job state vocabulary and transition map, backed by the database.

#### Scope

* `STATUS_CONTRACTS.md`
* `src/lib/jobStatus.js`
* `src/pages/crm/Jobs.jsx`
* `supabase/functions/work-order-update/index.ts`
* status-related migrations / constraints

#### Target State

* One canonical job status set
* One canonical transition map
* Alias behavior removed or formally migrated away
* DB is the enforcement authority
* App follows DB contract

#### Implementation Steps

1. Ratify final Pillar 1 job status vocabulary.
2. Inventory all status writers, aliases, and transitions.
3. Design migration for legacy rows and historical aliases.
4. Move authoritative transition enforcement into DB constraint/trigger/function layer.
5. Update edge/UI to consume canonical values only.
6. Remove silent alias remapping unless explicitly documented during migration window.
7. Add positive/negative transition tests.

#### Required Artifacts

* Final status contract sheet
* Status writer inventory
* Legacy data migration plan
* Transition test outputs
* Rollback note

#### PASS

* UI, edge, DB, docs all use same status vocabulary
* Invalid transitions fail consistently
* Historical data is migrated or explicitly handled

#### Rollback Note

* Migration must be reversible or staged; no irreversible cutover without verified data snapshot.

---

### P0-04 — Unified Commit RPC Lock

#### Objective

Route acceptance through one atomic commit path that creates or confirms the job exactly once.

#### Scope

* `supabase/functions/quote-update-status/index.ts`
* `supabase/functions/public-quote-approve/index.ts`
* acceptance trigger / RPC / transaction path
* quote accepted => job ensured logic

#### Target State

* One authoritative acceptance semantic
* Acceptance is atomic
* Accepted quote always produces exactly one job
* Public/internal acceptance share the same invariant path
* Commit emits consistent events

#### Implementation Steps

1. Decide authoritative acceptance entry point shape.
2. Implement unified DB transaction/RPC or equivalent atomic server-side path.
3. Route public and CRM acceptance through that path.
4. Remove floating acceptance behavior from `quote-update-status`.
5. Ensure initial job state comes from canonical status contract.
6. Add exactly-once tests and replay tests.
7. Emit consistent events for accept + job ensure.

#### Required Artifacts

* Commit flow spec
* Code diff for unified path
* Replay/idempotency logs
* DB proof: one quote => one job
* Event trace
* Rollback note

#### PASS

* Public and internal acceptance produce same durable result
* Repeated acceptance cannot create duplicate jobs
* No accepted state exists without a job

#### Rollback Note

* Feature-flag old acceptance UI path only for emergency revert during staged rollout.

---

## Phase 1 — Behavior Alignment

### P1-01 — Completion Gate Enforcement

* Enforce checklist + before photos + after photos + technician confirmation + completion summary before completion.
* PASS: invalid completion blocked; valid completion succeeds.

### P1-02 — Event Taxonomy Unification

* Standardize event names across send, accept, payment, completion.
* PASS: no duplicate/conflicting event names for same action.

### P1-03 — Payment Writer Mode Consolidation

* Explicit mode gates for local mock, webhook, offline, and public flows.
* PASS: only intended writer active per mode.

---

## Phase 2 — Structural Cleanup

### P2-01 — Quote/Estimate Path Cleanup

* Remove or isolate legacy estimate-first customer flows.
* PASS: one active canonical quote surface.

### P2-02 — Field/TIS Commit Entry Point Definition

* Define and simulate TIS commit payload and events.
* PASS: simulated field payload lands cleanly and idempotently.

---

## Operating Rules

* No production mutation until local proof exists.
* No merge without artifacts.
* No claim of completion without PASS evidence.
* No move to next phase while unresolved critical foundational items remain.

---

## Readiness States

* NOT_READY
* CONDITIONALLY_READY
* READY_FOR_NEXT_PHASE

Current State: NOT_READY
