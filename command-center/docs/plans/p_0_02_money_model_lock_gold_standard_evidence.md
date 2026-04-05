# EV-XXXX — P0-02 Money Model Lock (Gold Standard — Upgraded)

---

## 1. Objective

Eliminate mutable money-state updates and establish a trusted financial model where settlement truth is append-only, replay-safe, auditable, and reconcilable.

---

## 2. Financial Truth Invariant (LOCKED)

### Invariant
Financial truth is defined by the transaction ledger.

### Enforcement Rules
- Every financial effect is recorded as an immutable transaction
- Invoice paid state is a projection / derived state, not a primary mutable truth
- Replays MUST NOT create additional financial impact
- No payment writer may bypass transaction-first logic

### Failure Conditions
- Any additive mutation pattern such as `amount_paid = amount_paid + x` used as authoritative money truth
- Any payment path that creates durable money impact without a unique reference / idempotency key
- Any divergence between invoice paid state and the underlying transaction ledger
- Any writer that settles money outside the canonical transaction-first path

### Detection
- Replay tests
- Reconciliation queries
- Writer inventory audit
- Code scan for additive mutations

---

## 3. Source of Truth (Explicit)

### Authoritative Primitive
- `transactions` (or equivalent immutable ledger table) is the sole financial source of truth

### Derived / Projection State
- `invoice.amount_paid`
- `invoice.balance_due`
- `invoice.status`

These fields must be derived from or reconciled against the ledger and must not be treated as independently authoritative.

---

## 4. Coverage Boundary

### In Scope
- `supabase/functions/public-pay/index.ts`
- `supabase/functions/payment-webhook/index.ts`
- `supabase/functions/invoice-update-status/index.ts`
- SQL/RPC payment mutation paths
- transaction/receipt/event emission logic
- any internal/manual tooling that records payment state

### Not Yet in Scope
- refunds
- chargebacks
- reversals
- voids
- accounting export systems

### Constraint
Deferred cases above must NOT be implemented ad hoc while P0-02 is being stabilized.

---

## 5. Writer Doctrine

### Allowed Writer Classes
- Public payment path
- Provider webhook path
- Offline/manual payment path
- Local/mock path (non-production only)

### Doctrine
All writer classes MUST:
1. generate or receive a unique payment reference / idempotency key
2. write an immutable transaction first
3. reconcile invoice projection state through one authoritative routine
4. emit canonical events

### Non-Allowed Writer Behavior
- direct settlement by invoice mutation only
- additive updates as source of truth
- path-specific settlement semantics that bypass the ledger

---

## 6. Enforcement Map

| Invariant | Enforcement Layer | Detection |
|---|---|---|
| Transaction uniqueness | DB unique constraint on idempotency/payment reference | replay tests |
| Ledger authority | transaction-first write path | reconciliation query |
| Replay safety | duplicate detection before durable write | repeated-request tests |
| Projection correctness | invoice reconciliation routine | invoice vs transactions check |
| No additive money truth | code scan + code review gate | grep / review-gate |

---

## 7. Implementation Contract

### Authoritative Payment Sequence
1. Receive payment request or provider callback
2. Validate required reference / idempotency key
3. Attempt immutable transaction insert
4. If duplicate, return duplicate/replay-safe result without new financial impact
5. Reconcile or refresh invoice projection state from transactions
6. Emit canonical events
7. Return outcome

### Non-Allowed Sequence
- mutate invoice as authoritative write first
- write transaction later “for record keeping” only
- accept repeated request without dedupe check

---

## 8. Reconciliation Invariant

The system must always satisfy:

`invoice.amount_paid == SUM(applied transactions for invoice)`

and

`invoice.balance_due == invoice.total_amount - SUM(applied transactions for invoice)`

If projection state exists, it must be provably derivable from the ledger.

---

## 9. Atomicity / Staging Rule

### Required Rule
A payment must not create ambiguous partial financial state.

### Acceptable Models
- same DB transaction: insert transaction + update projection atomically
- deterministic staged model: insert transaction first, then run a guaranteed reconciliation routine that updates projections safely

### Not Acceptable
- invoice updated without durable transaction
- durable transaction exists but projection update has no deterministic recovery path

---

## 10. Idempotency Guarantee

### Required
Every payment writer must use a unique dedupe reference.

### Must Define During Implementation
- source of idempotency key/reference per writer
- DB uniqueness enforcement point
- duplicate response behavior

### Required Outcome
Repeated requests for the same payment produce one financial effect only.

---

## 11. Behavior Matrix (Target)

| Scenario | Expected |
|---|---|
| first payment | one transaction, correct invoice projection |
| replay same payment | no duplicate transaction, no extra financial effect |
| partial payment | additional transaction, correct running projection |
| webhook replay | duplicate ignored / no second effect |
| offline + webhook overlap | one authoritative settlement effect only |
| out-of-order callbacks | ledger remains correct and projection reconciles |

---

## 12. Dependencies

- transaction table must support immutable writes + uniqueness
- invoice projection logic must be centralized
- event taxonomy must support canonical payment lifecycle
- payment mode configuration must be explicit by environment

### Public-Token Client Dependency Note

Public-token client calls should omit `tenant_id` wherever possible.

Reason:
- tenant is derived server-side from the token-bound record
- client-supplied tenant creates unnecessary mismatch/error surface
- this reduces UI drift while preserving server-side authority

---

## 13. Logging & Event Integrity

### Rule
Every logical payment must emit a canonical, auditable event trail.

### Required Fields
- amount
- timestamp
- source (`public`, `webhook`, `offline`, `mock`)
- reference / idempotency key
- invoice identifier
- tenant identifier

### Replay Behavior
Duplicate submissions must either:
- emit no new financial event, or
- emit a clearly marked duplicate/replay event that does not alter money state

---

## 14. Migration Requirement

### Required Before Cutover
- inventory existing money mutation paths
- identify historical rows influenced by additive mutation model
- define comparison/reconciliation plan between current invoice totals and transaction ledger
- define staged rollout and backfill plan

### Constraint
No cutover without a migration plan and rollback-safe validation window.

---

## 15. Deferred Edge Cases Ledger

The following are explicitly deferred unless implemented under full financial controls:
- refunds
- chargebacks
- reversals
- voids
- manual reversal of offline payments

No ad hoc implementation is allowed during P0-02.

---

## 16. Regression Safeguards

- replay test suite required for every writer
- reconciliation query required after each payment-path test
- code scan for additive mutation patterns required
- any change touching money must pass review gate + financial checks before merge

### Merge Gate
Any change touching money MUST:
- pass replay tests
- pass reconciliation check
- prove no additive mutation is authoritative
- document writer mode impact

---

## 17. Blast Radius

If this invariant breaks:
- duplicate financial effects
- corrupted receivables
- incorrect paid/unpaid state
- broken reconciliation
- loss of trust in accounting outputs

Severity: CRITICAL

---

## 18. Forward Constraint

P0-02 is complete only when:
- all active money writers are transaction-first
- invoice projection state reconciles to ledger
- additive mutation model is removed from authoritative paths
- replay safety is proven for each writer class

Current state: NOT_STARTED / architecture upgrade required

---

## 19. Proof Map

Required proof set:
- writer inventory artifact
- replay test logs
- transaction table outputs
- invoice reconciliation outputs
- migration plan
- rollback note

---

## 20. Rollback Strategy (Controlled)

### Rule
Do NOT revert to unsafe additive money mutation as a normal rollback.

### If rollback is required
- freeze payment writes
- preserve current ledger/projection state snapshot
- restore prior deploy only under controlled validation
- reprocess or reconcile transactions safely before reopening payment writes

---

## 21. Status

- Classification: NOT_STARTED
- Readiness: NOT_READY

---

## 22. App-Side Constraint for Public Token Flows

### Decision
For public-token endpoints, the client should omit `tenant_id` entirely wherever possible.

### Why
- tenant is now derived server-side from the token-bound record
- sending `tenant_id` from the UI creates avoidable mismatch/error surface
- it reduces the chance of client-side drift reintroducing tenant confusion

### Rule
- public-token UI calls should send only the token and required non-tenant payload
- `tenant_id` remains optional only for server-side validation compatibility, not as a required client input

### Caveat
This is a hardening improvement, not the primary security control. The true control remains server-side tenant derivation.

---

## 23. P0-02 IMPLEMENTATION PACKET (DRAFT → CRITIQUE x3 → FINAL)

### Draft v1 — Working Implementation Packet

#### Immediate Goal
Replace unsafe additive money mutation with a transaction-first payment model that is replay-safe and reconcilable.

#### Files to Inspect First
- `supabase/functions/public-pay/index.ts`
- `supabase/functions/payment-webhook/index.ts`
- `supabase/functions/invoice-update-status/index.ts`
- any SQL/RPC used by those payment paths
- transaction/invoice schema or migration files

#### First-Step Tasks
1. Inventory all payment writers and classify them:
   - public
   - webhook
   - offline
   - mock/local
2. Identify every place invoice totals are directly mutated.
3. Identify whether a canonical `transactions` table already exists and what uniqueness constraints it has.
4. Define idempotency key/reference strategy per writer.
5. Refactor offline payment path to transaction-first write.
6. Define reconciliation query for invoice projection.
7. Add replay tests.
8. Update docs/evidence.

#### Required Artifacts
- writer inventory
- additive mutation scan output
- replay logs
- reconciliation outputs
- migration note
- rollback note

#### PASS
- duplicate payment requests do not create duplicate financial effect
- invoice projection reconciles to transactions
- no authoritative additive mutation remains in patched path

---

### Critique Round 1 — Weaknesses in Draft v1
1. **Too focused on offline payments first**
   - This risks patching one writer while leaving the money model ambiguous across all writers.
2. **No explicit requirement to freeze writer doctrine before refactor**
   - If writer ownership is not decided first, you can still end up with multiple paths behaving differently.
3. **No explicit atomicity decision**
   - The packet does not force a choice between same-transaction update vs deterministic staged reconciliation.
4. **No historical data comparison requirement**
   - You could patch code while leaving old invoice totals inconsistent with the transaction ledger.
5. **No app-side dependency review**
   - UI/services may still assume direct invoice mutation semantics.

### Revised v2 — Working Implementation Packet

#### Immediate Goal
Define and enforce a single transaction-first financial model before modifying individual payment writers.

#### Required Phase Order for P0-02
1. Writer inventory and doctrine freeze
2. Ledger authority decision
3. Atomicity/staging decision
4. Historical data comparison and migration plan
5. Path-by-path implementation
6. Replay and reconciliation testing
7. Evidence capture

#### Expanded First-Step Tasks
1. Inventory all money writers and all invoice mutation paths.
2. Freeze writer doctrine:
   - which writers exist
   - which writer is allowed in which mode/environment
   - which shared transaction routine they must use
3. Prove current transaction table capabilities:
   - immutability assumptions
   - uniqueness options
   - invoice linkage
4. Decide authoritative model for projection updates:
   - same DB transaction, or
   - deterministic reconciliation routine
5. Compare historical invoice totals against recorded transactions and identify drift risk.
6. Review app/service dependencies that assume direct invoice mutation.
7. Patch one writer path only after the above is locked.
8. Add replay, overlap, and reconciliation tests.

#### Required Artifacts
- writer doctrine sheet
- transaction table capability review
- invoice mutation inventory
- historical comparison query output
- app dependency note
- replay/reconciliation logs
- migration plan
- rollback strategy

#### PASS
- writer doctrine is explicit
- projection model is explicit
- one patched writer proves replay-safe behavior without reconciliation drift

---

### Critique Round 2 — Remaining Risks in Revised v2
1. **Still not explicit enough about cross-writer overlap**
   - Need a concrete test for offline + webhook and public + webhook overlaps.
2. **No explicit prohibition on partial patching of invoice projection fields**
   - A developer might keep mutating `amount_paid` “temporarily.”
3. **No requirement to define duplicate response behavior**
   - What should the system return on replay? ignore? duplicate flag? existing transaction?
4. **No event taxonomy requirement tied to money writers**
   - Writers could remain financially correct but observability stays incoherent.
5. **No stop condition tied to additive mutation scan**
   - The implementation could proceed while legacy additive paths remain hidden.

### Revised v3 — Working Implementation Packet

#### Immediate Goal
Lock writer doctrine and payment semantics first, then patch writers into a transaction-first model with replay-safe outcomes and coherent observability.

#### Mandatory Preconditions
Before patching any writer:
1. Writer doctrine frozen
2. Ledger authority explicitly accepted
3. Projection update model chosen
4. Additive mutation scan completed
5. Historical comparison query run

#### Expanded Task Set
1. **Writer inventory + doctrine freeze**
   - enumerate every payment writer and classify by mode
   - declare allowed writer per mode/environment
   - define shared transaction routine requirement
2. **Additive mutation audit**
   - grep/search all `amount_paid`, `balance_due`, `status='paid'`, and related mutation patterns
   - classify each as authoritative, derived, legacy, or unknown
3. **Ledger capability review**
   - inspect transactions table structure, uniqueness columns, invoice linkage, source/method fields
4. **Projection model decision**
   - decide same-transaction vs deterministic reconciliation
   - document duplicate response behavior
5. **Historical comparison**
   - compare invoice projection totals against transaction sums
   - quantify existing drift before migration
6. **App/service dependency review**
   - identify UI/services expecting immediate mutable invoice fields
7. **Patch path implementation**
   - start with offline payment writer or chosen first path only after preconditions pass
8. **Cross-writer overlap tests**
   - offline + webhook
   - public + webhook
   - replay same payment
   - partial payment replay
9. **Observability verification**
   - event names and duplicate behavior documented and tested
10. **Artifact capture and board update**

#### Required Artifacts
- writer doctrine sheet
- additive mutation audit output
- transactions capability review
- historical drift query output
- duplicate response contract
- replay/overlap test logs
- reconciliation outputs
- migration plan
- rollback strategy

#### PASS
- one writer path proven transaction-first and replay-safe
- overlap tests show no duplicate financial effect
- additive mutation is not authoritative in the patched path
- invoice projections reconcile to transactions

---

### Critique Round 3 — Final Hard Review
1. **Needs an explicit boundary for the first writer to patch**
   - Without choosing the first writer, execution can sprawl.
2. **Needs stop condition if historical drift is severe**
   - If current data is badly inconsistent, implementation should pause for migration-first handling.
3. **Needs explicit no-dual-truth rule during rollout**
   - During transition, invoice projection cannot be treated as equally authoritative alongside ledger.
4. **Needs merge gate language strong enough to block tactical shortcuts**
   - “temporary additive mutation” must be explicitly forbidden.
5. **Needs public-token client hardening note carried into payment path review**
   - public payment calls should omit tenant_id entirely to reduce drift.

### Final v4 — Working Implementation Packet (Approved)

#### Immediate Goal
Implement P0-02 by first freezing financial doctrine, then patching one payment writer into a transaction-first, replay-safe, reconciliation-backed model without allowing dual financial truth.

#### First Writer Boundary
- The first writer to patch is: **offline/manual payment path** (`invoice-update-status`), because it is explicitly non-idempotent in the current audit and is the clearest controllable mutation path.

#### Hard Rules
1. No writer patching before doctrine freeze.
2. No dual-truth model: ledger is authoritative during and after rollout.
3. No temporary additive mutation as authoritative behavior.
4. Public-token payment calls should omit `tenant_id` client-side wherever possible; server still derives tenant.
5. If historical drift is severe, pause implementation and handle migration/reconciliation first.

#### Execution Checklist
1. **Freeze doctrine**
   - writer inventory
   - allowed writer per mode/environment
   - canonical duplicate response behavior
   - canonical event names for money flows
2. **Run additive mutation audit**
   - search and classify all additive money mutations
3. **Review ledger capability**
   - transaction uniqueness, invoice linkage, source/method fields
4. **Choose projection model**
   - same-transaction or deterministic reconciliation
5. **Run historical drift comparison**
   - if severe drift found, stop and open migration-first subphase
6. **Review app/service dependencies**
   - especially offline payment UI and any public-pay client use
7. **Patch offline writer**
   - transaction-first write
   - dedupe key enforcement
   - duplicate-safe response
8. **Run tests**
   - replay same offline payment
   - partial payment replay
   - overlap scenario if possible
   - reconciliation query
9. **Verify observability**
   - events emitted correctly
   - duplicates marked or suppressed according to doctrine
10. **Capture artifacts + update board**

#### Required Output for This Step
- writer doctrine artifact
- additive mutation audit
- projection model decision note
- historical drift summary
- code diff for offline writer
- replay/overlap/reconciliation logs
- service/UI dependency note
- rollback note

#### Stop / Pass Review
Stop only when:
- doctrine is frozen
- additive mutation audit complete
- historical drift assessed
- offline writer patched transaction-first
- replay test passes
- reconciliation passes
- artifacts captured and board updated

---
