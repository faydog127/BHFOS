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

#### Current Status (2026-04-04)
- Status: LOCAL_PROVEN (negative tests + endpoint boot verified)
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-01_tenant-isolation-lock.md`
- Test log: `tmp/p0-01-tenant-isolation-test.log`
- Note: public endpoints still use service-role (`supabaseAdmin`); tenant boundary is now derived-from-token + mismatch rejection, but RLS remains bypassed on these paths.

#### Scope
- `supabase/functions/public-quote/index.ts`
- `supabase/functions/public-invoice/index.ts`
- `supabase/functions/public-pay/index.ts`
- Any public token lookup path
- Relevant RLS / DB policy surfaces

#### Target State
- No `tenant_id` fallback to `tvg`
- No request-supplied tenant decides access by itself
- Tenant derived from authoritative lookup or token binding
- Public endpoints reject missing/mismatched tenant context
- Service-role use minimized and justified

#### Implementation Steps
1. Inventory all public token-based endpoints and current tenant resolution behavior.
2. Remove `tenant_id || 'tvg'` fallback behavior.
3. Refactor token lookup so tenant is derived server-side from token-bearing record.
4. Review whether public endpoints can avoid service-role or must remain tightly scoped.
5. Add explicit mismatch rejection and logging.
6. Add negative tests: correct tenant, missing tenant, wrong tenant, leaked token scenario.
7. Update docs and evidence.

#### Required Artifacts
- Code diff showing fallback removal
- Runtime negative test outputs
- Endpoint behavior matrix
- DB/RLS review notes
- Rollback note

#### PASS
- Wrong/missing tenant cannot silently resolve
- Public token access cannot cross tenant boundary
- Evidence demonstrates rejection behavior and correct behavior

#### Rollback Note
- Keep prior endpoint logic behind a temporary fallback branch only if needed for emergency revert; remove once verified.

#### P0-01 IMPLEMENTATION PACKET

##### Immediate Goal
Patch the public document/payment endpoints so tenant resolution is no longer controlled by request input or a default fallback.

##### Files to Inspect First
- `supabase/functions/public-quote/index.ts`
- `supabase/functions/public-invoice/index.ts`
- `supabase/functions/public-pay/index.ts`
- any shared public utility used by those endpoints
- relevant migration/policy files governing quote/invoice public token lookup

##### Problems Already Confirmed
- Public endpoints currently accept `tenant_id` from request and default to `tvg` while using service-role access.
- This creates tenant-isolation risk if a token leaks or if request context is malformed.

##### Required Design Decision for This Fix
Use this rule:
- **tenant is derived from the token-bearing record server-side**
- request-supplied `tenant_id` becomes optional at most for validation, never authority

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
- Do not redesign the whole auth model in this step.
- Do not widen service-role use.
- Do not touch unrelated CRM authenticated endpoints yet.
- Do not change payment writer architecture here.

##### Test Matrix (Must Run)
1. **Correct token + no tenant_id**
   - Expected: success using derived tenant
2. **Correct token + correct tenant_id**
   - Expected: success
3. **Correct token + wrong tenant_id**
   - Expected: reject
4. **Correct token + missing tenant_id**
   - Expected: success only if tenant is derived server-side, never via fallback
5. **Invalid token + any tenant_id**
   - Expected: reject
6. **Leaked token simulation**
   - Expected: access limited strictly to token-bound record, no tenant switching

##### Required Output for This Step
- endpoint-by-endpoint behavior matrix before/after
- exact code paths changed
- negative test logs
- evidence note for tracking board
- explicit statement on whether service-role remains and why

##### What Success Looks Like
- No endpoint contains `tenant_id || 'tvg'`
- No public route trusts request tenant as authority
- Wrong tenant input fails hard
- Missing tenant input does not silently select a default tenant
- Logs/events show derived tenant context

##### Stop Conditions
- All three public endpoints patched
- Test matrix completed
- artifacts captured
- tracking board updated

#### P0-01 WORKING CHECKLIST (DRAFT → CRITIQUE x2 → FINAL)

##### Draft v1 — Working Checklist
1. Open and inspect:
   - `supabase/functions/public-quote/index.ts`
   - `supabase/functions/public-invoice/index.ts`
   - `supabase/functions/public-pay/index.ts`
2. Identify every place tenant is resolved from:
   - query params
   - request body
   - fallback default
   - shared helper
3. Identify the token-bearing record used by each endpoint:
   - quote by `public_token`
   - invoice by `public_token`
   - payment target by `public_token`
4. Replace request-authoritative tenant resolution with server-derived tenant resolution.
5. If request includes `tenant_id`, validate it against derived tenant and reject on mismatch.
6. Remove all `|| 'tvg'` or equivalent default tenant behavior.
7. Add explicit structured error responses for:
   - missing token
   - invalid token
   - tenant mismatch
8. Add logging/event notes using derived tenant only.
9. Run the full test matrix.
10. Capture artifacts and update the board.

##### Critique Round 1 — Weaknesses in Draft v1
1. **Token lookup order not explicit enough**
   - Draft says “derive tenant from token-bearing record” but does not force the lookup sequence. That could lead to code that still filters by request tenant before token lookup.
2. **No requirement to prove public_token uniqueness assumptions**
   - If token uniqueness is tenant-scoped rather than globally unique, the lookup method must account for that.
3. **No explicit rule for service-role minimization review**
   - The checklist patches behavior but could forget to document why service-role remains or whether it can be narrowed.
4. **Error contract not defined**
   - “reject” is vague; different endpoints could return inconsistent status codes/messages.
5. **No regression check for happy path payload shape**
   - The change could secure tenant binding but accidentally break existing quote/invoice/pay response formats.

##### Revised v2 — Working Checklist
1. Inspect endpoint files and any shared helper they call.
2. For each endpoint, document current resolution chain in this exact order:
   - token source
   - tenant source(s)
   - fallback source
   - query target
   - response fields
3. Determine whether `public_token` is globally unique or tenant-scoped by schema/code evidence.
4. Implement lookup sequence in this exact order:
   - read token from request
   - reject if token missing
   - fetch token-bearing record by token using authoritative lookup
   - derive tenant from located record
   - if request tenant is present and mismatched, reject
   - continue using derived tenant only
5. Remove all default tenant fallback behavior.
6. Standardize rejection contract across endpoints:
   - invalid/missing token
   - tenant mismatch
   - record not found
7. Review service-role use for each endpoint and record one of:
   - retained and justified
   - narrowed
   - removed
8. Run regression on successful happy path responses to confirm no unintended payload break.
9. Run full negative test matrix.
10. Capture artifacts and update board.

##### Critique Round 2 — Remaining Risks in Revised v2
1. **No explicit grep/search step for hidden fallback strings**
   - A shared utility or second code path could still contain default tenant logic.
2. **No explicit event/log review**
   - The endpoint may behave correctly but still emit misleading tenant context in logs/events.
3. **No rollback verification step**
   - We mention rollback note in the board, but the checklist should force a rollback artifact.
4. **No boundary for what counts as leaked-token simulation**
   - This needs to be concrete enough to test repeatably.
5. **No evidence naming convention check**
   - Artifacts can be captured but still fail the formal evidence pack if not linked/named correctly.

##### Final v3 — Working Checklist (Approved)
1. **Discovery and current-state capture**
   - Inspect:
     - `supabase/functions/public-quote/index.ts`
     - `supabase/functions/public-invoice/index.ts`
     - `supabase/functions/public-pay/index.ts`
   - Search for all tenant fallback patterns and tenant resolution logic:
     - `tenant_id`
     - `|| 'tvg'`
     - `params.get('tenant_id')`
     - `body?.tenant_id`
     - any shared helper imported by the three endpoints
   - Record current behavior endpoint-by-endpoint.
2. **Authority check on token model**
   - Prove by schema/code whether `public_token` is globally unique or not.
   - Record the evidence used to justify the lookup method.
3. **Patch tenant resolution**
   - Enforce this exact sequence:
     1. read token
     2. reject if token missing
     3. lookup record by token
     4. derive tenant from record
     5. if request tenant is present and mismatched, reject
     6. ignore request tenant as authority
   - Remove all fallback default tenant behavior.
4. **Standardize rejection behavior**
   - Define and implement consistent error responses for:
     - missing token
     - invalid token / record not found
     - tenant mismatch
5. **Review service-role boundary**
   - For each endpoint, explicitly record:
     - why service-role remains, or
     - how it was narrowed, or
     - whether it was removed
   - No silent carry-forward.
6. **Review logs/events**
   - Confirm logs/events use derived tenant context only.
   - Confirm no fallback/default tenant appears in event records for patched flows.
7. **Happy-path regression check**
   - Re-run valid token path for quote/invoice/pay.
   - Confirm expected response payload shape is preserved where intended.
8. **Negative test matrix execution**
   - correct token + no tenant_id
   - correct token + correct tenant_id
   - correct token + wrong tenant_id
   - invalid token + any tenant_id
   - leaked-token simulation = valid token replayed with intentionally wrong tenant_id and checked for rejection / no alternate tenant access
9. **Artifact capture**
   - Save:
     - code diff
     - test logs
     - behavior matrix before/after
     - event/log review note
     - service-role review note
     - rollback note
   - Ensure artifact names/locations fit formal evidence tracking and can be linked from the governing index.
10. **Stop / pass review**
   - Stop only when:
     - all 3 endpoints patched
     - no default tenant fallback remains
     - wrong tenant requests fail
     - missing/invalid token fails cleanly
     - happy path still works
     - artifacts captured and board updated

### P0-02 — Money Model Lock
#### Objective
Move money truth toward transaction-ledger authority and stop unsafe additive mutation patterns.

#### Current Status (2026-04-04)
- Status: LOCAL_PROVEN for P0-02.B (offline/manual writer slice)
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02B_offline-manual-payment-writer.md`
- Test log: `tmp/p0-02b-offline-manual-payment-test.log`
- DB proof: `tmp/p0-02b-db-proof.json`
- Additive mutation scan (scoped): `tmp/p0-02b-additive-mutation-scan.log`
- Status: LOCAL_PROVEN for P0-02.C (payment-webhook slice: dual idempotency + concurrency-safe settlement)
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02C_payment-webhook-rebuild.md`
- Test log: `tmp/p0-02c-payment-webhook-test.log`
- Status: LOCAL_PROVEN for P0-02.D (public-pay slice: initiation-only + duplicate-safe + webhook convergence)
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02D_public-pay-initiation-boundary.md`
- Test log: `tmp/p0-02d-public-pay-test.log`
- Status: LOCAL_PROVEN for P0-02.E (reconciliation sweep + resolution tools)
- Evidence: `docs/reconciliation/lock/appendix-a/evidence/EV-2026-04-04_P0-02E_reconciliation-tools.md`
- Sweep proof log: `tmp/p0-02e-sweep-test.log` (covers dropped-webhook recovery, ghost intent cleanup, drift flagging, quarantine surfacing, legacy ingest+flag, idempotency, race convergence, batch safety)

#### P0-02 — Post-Local Production Gate (Ticket)

- Ticket: `docs/tickets/TICKET_P0-02_production-validation_post-local-gate.md`
- Tracking board: `tmp/tickets_board.md`
- Test log: `tmp/p0-02e-reconciliation-test.log`

#### Hardening Notes (2026-04-04)
- Test bypass headers are now explicitly gated (local + explicit test mode required).
- `invoices.provider_payment_id` is DB-immutable once set.
- Money-loop canonical event emission is deduped via DB unique indexes (by transaction_id / checkout_session_id).

#### Scope
- `supabase/functions/invoice-update-status/index.ts`
- `supabase/functions/payment-webhook/index.ts`
- `supabase/functions/public-pay/index.ts`
- transaction tables / invoice totals derivation logic
- any SQL/RPC payment mutation path

#### Target State
- Payments are recorded as durable transaction entries
- Invoice paid/balance state is derived or transaction-backed
- Offline payment path is idempotent
- Replays cannot double-record money

#### Implementation Steps
1. Inventory every payment writer and classify mode: public, webhook, offline, mock.
2. Define canonical transaction model for online and offline settlement.
3. Refactor offline payment path to write immutable transaction with unique idempotency key/reference.
4. Prevent direct additive mutation as final source of truth.
5. Ensure invoice totals are reconciled from transactions or updated through one authoritative routine.
6. Add replay tests for offline and online paths.
7. Add migration plan for any historical data normalization.

#### Required Artifacts
- Payment writer manifest
- Transaction model spec
- Idempotency proof logs
- Replay test outputs
- Migration plan
- Rollback note

#### PASS
- Same payment request cannot mutate money twice
- Transactions remain singular and auditable
- Invoice totals reconcile correctly after replay tests

#### Rollback Note
- Preserve current path only long enough to compare outputs during validation; do not leave dual writers active after cutover.

---

### P0-03 — State Machine Authority Lock
#### Objective
Make one authoritative job state vocabulary and transition map, backed by the database.

#### Scope
- `STATUS_CONTRACTS.md`
- `src/lib/jobStatus.js`
- `src/pages/crm/Jobs.jsx`
- `supabase/functions/work-order-update/index.ts`
- status-related migrations / constraints

#### Target State
- One canonical job status set
- One canonical transition map
- Alias behavior removed or formally migrated away
- DB is the enforcement authority
- App follows DB contract

#### Implementation Steps
1. Ratify final Pillar 1 job status vocabulary.
2. Inventory all status writers, aliases, and transitions.
3. Design migration for legacy rows and historical aliases.
4. Move authoritative transition enforcement into DB constraint/trigger/function layer.
5. Update edge/UI to consume canonical values only.
6. Remove silent alias remapping unless explicitly documented during migration window.
7. Add positive/negative transition tests.

#### Required Artifacts
- Final status contract sheet
- Status writer inventory
- Legacy data migration plan
- Transition test outputs
- Rollback note

#### PASS
- UI, edge, DB, docs all use same status vocabulary
- Invalid transitions fail consistently
- Historical data is migrated or explicitly handled

#### Rollback Note
- Migration must be reversible or staged; no irreversible cutover without verified data snapshot.

---

### P0-04 — Unified Commit RPC Lock
#### Objective
Route acceptance through one atomic commit path that creates or confirms the job exactly once.

#### Scope
- `supabase/functions/quote-update-status/index.ts`
- `supabase/functions/public-quote-approve/index.ts`
- acceptance trigger / RPC / transaction path
- quote accepted => job ensured logic

#### Target State
- One authoritative acceptance semantic
- Acceptance is atomic
- Accepted quote always produces exactly one job
- Public/internal acceptance share the same invariant path
- Commit emits consistent events

#### Implementation Steps
1. Decide authoritative acceptance entry point shape.
2. Implement unified DB transaction/RPC or equivalent atomic server-side path.
3. Route public and CRM acceptance through that path.
4. Remove floating acceptance behavior from `quote-update-status`.
5. Ensure initial job state comes from canonical status contract.
6. Add exactly-once tests and replay tests.
7. Emit consistent events for accept + job ensure.

#### Required Artifacts
- Commit flow spec
- Code diff for unified path
- Replay/idempotency logs
- DB proof: one quote => one job
- Event trace
- Rollback note

#### PASS
- Public and internal acceptance produce same durable result
- Repeated acceptance cannot create duplicate jobs
- No accepted state exists without a job

#### Rollback Note
- Feature-flag old acceptance UI path only for emergency revert during staged rollout.

---

## Phase 1 — Behavior Alignment

### P1-01 — Completion Gate Enforcement
- Enforce checklist + before photos + after photos + technician confirmation + completion summary before completion.
- PASS: invalid completion blocked; valid completion succeeds.

### P1-02 — Event Taxonomy Unification
- Standardize event names across send, accept, payment, completion.
- PASS: no duplicate/conflicting event names for same action.

### P1-03 — Payment Writer Mode Consolidation
- Explicit mode gates for local mock, webhook, offline, and public flows.
- PASS: only intended writer active per mode.

---

## Phase 2 — Structural Cleanup

### P2-01 — Quote/Estimate Path Cleanup
- Remove or isolate legacy estimate-first customer flows.
- PASS: one active canonical quote surface.

### P2-02 — Field/TIS Commit Entry Point Definition
- Define and simulate TIS commit payload and events.
- PASS: simulated field payload lands cleanly and idempotently.

---

## Operating Rules
- No production mutation until local proof exists.
- No merge without artifacts.
- No claim of completion without PASS evidence.
- No move to next phase while unresolved critical foundational items remain.
- Next-chat bootstrap: `tmp/handshake_next_chat.md`

---

## Readiness States
- NOT_READY
- CONDITIONALLY_READY
- READY_FOR_NEXT_PHASE

Current State: NOT_READY
