# 08_send_estimate_contract_gates_execution_plan.md

## Purpose
Document the implementation plan for upgrading `send-estimate` from a basic notification sender to a contract-grade quote send pipeline, with immutable snapshots, policy versioning, and compliance gates.

This file is the handoff source of truth if work is paused and resumed later.

## Current State (as of 2026-02-19)
- `send-estimate` is active in production.
- Cost/margin guardrail enforcement is temporarily disabled to avoid blocking outbound quote sends.
- Required-field validation still runs (quote number, valid-until date, line items, recipient email, total amount).
- Quote sending works, but contract-grade snapshot/policy lock architecture is not fully implemented.

## Non-Goals for This Plan
- Do not modify invoice send/payment receipt behavior in this phase.
- Do not rework non-money-loop CRM pages unless required for quote send compliance.

## Target Architecture
1. DB-first policy/versioning and immutable send-document storage.
2. Function-level gates and snapshot hash lock at send time.
3. UI pre-send checklist and policy resolution visibility.

## Phase Sequence (Strict Order)

### Phase 1: Database Foundation (DB First)
1. Create policy versioning tables:
   - `quote_policy_versions`
   - `quote_policy_bundle_map`
2. Create immutable send document table:
   - `quote_send_documents`
3. Add quote linkage fields:
   - `quotes.current_send_document_id`
   - `quotes.snapshot_locked_at`
   - optional `quotes.version_number`
4. Ensure tenant compliance profile has:
   - `legal_entity_name`
   - `license_numbers`
   - `insurance_expiration_date`
   - `jurisdiction_state`
5. Add RLS + indexes for new tables.

#### Stop Gate A
- Migrations applied on target environment.
- New tables queryable.
- RLS validated with tenant-scoped reads/writes.
- Seed policy versions inserted for active service types/jurisdictions.

### Phase 2: Edge Function Gate Engine
1. Update `send-estimate` to:
   - resolve policy bundle from jurisdiction/service type
   - validate send gates
   - build canonical send payload
   - compute/store `document_hash`
   - persist immutable `quote_send_documents` row before send
2. Update approval flow (`public-quote` / `public-quote-approve`) to render/validate against sent snapshot.
3. Add/standardize send events with:
   - `document_id`
   - `document_hash`
   - policy version ids
   - sender/user metadata

#### Stop Gate B
- Every successful send has a persisted immutable document row.
- Approval validates the same document hash/version that was sent.
- Events include `document_id` + `document_hash`.

### Phase 3: UI/Workflow Integration
1. Add send preflight panel in proposal UI:
   - pass/fail gates with explicit block reasons
2. Add scope/prep/compliance inputs required by send gates.
3. Add policy admin visibility (active policy versions by service/jurisdiction).

#### Stop Gate C
- User can prepare and send compliant quote from UI without DB/manual intervention.
- UI block reasons are deterministic and actionable.

### Phase 4: Controlled Rollout
1. Stage: enable enforcement and run full matrix.
2. Production: enable enforcement after stage pass.
3. Monitor block rates and conversion metrics.

## Send-Time Contract Gates (v1)
1. Identity fields present.
2. Legal profile complete.
3. Insurance not expired.
4. Scope snapshot complete.
5. Jurisdiction-required disclosures present.
6. Pricing snapshot frozen and valid.
7. Policy bundle resolved and versioned.
8. Snapshot locked with hash.
9. Approval link route valid.
10. Acceptance verifies hash/version.

## Out-of-Time / Resume Protocol
If work pauses before completion:
1. Keep guardrail enforcement disabled (to avoid operational outage).
2. Record latest completed stop gate in this file (A, B, or C).
3. Add the next pending task under "Resume Queue" below.
4. Do not enable enforcement flags until Stop Gate B is complete.

## Resume Queue
- [ ] Phase 1 migrations authored and reviewed.
- [ ] Phase 1 migrations applied to staging.
- [ ] Policy seed data inserted (FL + active TVG services).
- [ ] `send-estimate` immutable document write path implemented.
- [ ] Approval flow switched to sent snapshot rendering.
- [ ] UI preflight checklist implemented.
- [ ] Stage verification matrix completed.
- [ ] Production enforcement enabled.

## Verification Matrix (Required Before Prod Enforcement)
- Gmail desktop/mobile render
- Yahoo desktop/mobile render
- Dark mode render
- Approval link route + action success
- Snapshot hash/version lock success
- Event logging completeness
- Blocked send behavior for each gate

## Ownership
- DB migrations: Backend owner
- Edge functions: Money-loop owner
- UI checklist/policy visibility: CRM frontend owner
- Go-live decision: Product/Operations owner

