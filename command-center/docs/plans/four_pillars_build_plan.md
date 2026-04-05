# Four Pillars Build Plan (Pressure-Tested v4 — Hardened Agent Framework)

## Objective
Build a **single, enforced residential revenue pipeline** (inspection → decision → commit → job → invoice → payment → completion → document) with no floating states, no duplicate paths, and no post-hoc data entry.

---

## GLOBAL NON-NEGOTIABLES (applies to all pillars)
- No feature work that introduces new paths to create/modify Quote/Job/Invoice/Payment.
- No UI built before contracts (schemas, invariants, state transitions) are locked.
- No "accepted" state without immediate commit (Quote accepted → Job created).
- No direct writes to financial state outside canonical writer.
- Every critical action emits an event (success/failure) with trace IDs.
- Every deliverable must produce **evidence artifacts** (logs, screenshots, IDs) to PASS.

---

## PILLAR 1 — Command-Center Stabilization (LOCK)
### Goal
Prove the canonical money loop works end-to-end under real usage and cannot drift.

### Acceptance Tests (must PASS)
1. Quote → Accept → Job auto-created (exactly once, idempotent).
2. Job → Invoice → Payment (single canonical writer) → Receipt.
3. No alternate path can mark "paid".
4. Completion requires artifacts (photos + checklist) or is blocked.
5. Status transitions only from contract; no free-text states accepted.

### Blocking Gaps (convert to tickets)
- [ ] Remove/disable all non-canonical estimate/quote entry points.
- [ ] Status contract diff audit: UI vs DB vs services → eliminate drift.
- [ ] Completion gate: enforce required artifacts before `completed`.
- [ ] Payment write-path audit: ensure only invoice writer mutates money state.
- [ ] Tenant/auth audit: remove tenant fallback on admin endpoints.
- [ ] Appendix A evidence: money-loop smoke, manual UX, flow trace → COMPLETE.

### Evidence Required
- IDs for Quote/Job/Invoice/Payment per test run
- Logs showing idempotent behavior
- Screenshots of blocked invalid actions

### Definition of Done
All acceptance tests PASS with evidence; Appendix A marked LOCKED.

---

## PILLAR 2 — TIS CLOSE MODE (Residential Engine)
### Goal
Enable a technician to go from arrival → inspection → presentation → signed decision in <10 minutes.

### Hard Constraints
- Zero freestyle pricing in close mode
- Zero floating approvals
- Zero post-signature mutation without revision flow

### Screen Flow (locked)
1. Load Customer/Property
2. Guided Inspection (checklist)
3. Photo Capture (required minimums)
4. Findings Review (auto narrative)
5. GBB Builder (price-book only)
6. Presentation (customer view)
7. Selection
8. Signature
9. Commit
10. Result (success/failure)

### Step-Level Data Requirements
- Inspection: required checklist items + photos
- GBB: tier + line items + totals from price book
- Signature: timestamp + signer + hash
- Fulfillment: `same_visit | schedule_later`

### Performance Targets
- Build GBB ≤ 30 seconds
- Full flow ≤ 10 minutes
- Commit round-trip ≤ 2 seconds (online)

### Definition of Done
- 5 real field runs complete without manual re-entry
- All runs produce valid commit payloads
- No tech confusion observed in flow

---

## PILLAR 3 — TIS → COMMAND-CENTER HANDOFF (SPINE)
### Goal
Define the **only** way a field decision becomes system truth.

### Commit Invariant
Field "YES" ⇒ immediate, idempotent commit ⇒ Quote accepted + Job created.

### Pre-Commit Validation (must pass)
- Required findings present
- Required photos present
- Tier selected
- Pricing snapshot locked
- Signature captured
- Fulfillment mode selected

### Canonical Payload (v1)
```json
{
  "customer_id": "uuid",
  "property_id": "uuid",
  "quote": {
    "tier": "good|better|best",
    "line_items": [{"sku":"...","qty":1,"price":100}],
    "total": 100,
    "snapshot": true
  },
  "inspection": {
    "findings": ["..."],
    "photos": ["url"]
  },
  "signature": {
    "captured": true,
    "ts": "iso",
    "hash": "..."
  },
  "fulfillment_mode": "same_visit|schedule_later",
  "session_id": "uuid"
}
```

### Command-Center Responsibilities
- Validate payload
- Create/accept quote
- Enforce `accepted → job` invariant (idempotent)
- Stage invoice lifecycle
- Return identifiers + status

### Failure Handling
- No silent failure
- Error surfaced to operator
- Retry with idempotency key
- Local recovery record if offline

### Observability
- Emit events: `commit_attempt`, `commit_success`, `commit_fail`
- Correlate via `session_id`

### Definition of Done
- Contract documented and versioned
- Idempotency proven under retries
- Failure + retry behavior demonstrated

---

## PILLAR 4 — DOCUMENT + LANGUAGE SYSTEM
### Goal
Ensure what is sold = what is shown = what is billed = what is delivered.

### Invariant
All customer-facing text originates from a single service language library.

### Service Language Schema
- name (locked)
- short_description
- long_description
- outcome
- risk_if_not_done
- when_to_recommend
- tier_mapping

### Document Types
- Quote/Estimate
- Work Order
- Invoice
- Receipt
- Certification

### Structure Standard
- Header (brand + job)
- Services (from library)
- Proof (photos)
- Outcome
- Financials
- Trust (standards, signature)

### Definition of Done
- Same language appears across TIS + Quote + Invoice
- No ad hoc descriptions
- Clear GBB differentiation

---

## EXECUTION SEQUENCE
1. Pillar 1 (LOCK)
2. Pillar 3 (CONTRACT)
3. Pillar 2 (BUILD)
4. Pillar 4 (LANGUAGE)

---

## DELIVERY CADENCE (STRICT)
- Weekly: 1 pillar focus only
- Daily: evidence-producing tasks only
- No parallel pillar work

---

## CURRENT RISKS (EXPLICIT)
- Building UI before contract (creates rework)
- Leaving alternative estimate paths alive (creates drift)
- Weak field validation (fast bad data)
- Missing observability (hidden failures)

---

## NEXT 72 HOURS (EXECUTION)
1. Finalize Command-Center gap list with owners
2. Complete 1 full money-loop smoke test with evidence
3. Draft handoff contract v1 (this doc becomes spec)
4. Identify all non-canonical estimate paths to remove

---

## HARDENED AGENT FRAMEWORK (DRAFT → PEER REVIEW → PRESSURE TEST → FINAL)

### Purpose
Create a supervised, verification-driven agent system that can safely support Pillar 1 without producing false confidence, runaway noise, or shallow audits.

---

### DRAFT v1 — FRAMEWORK

#### 1. System Model
The framework is not a swarm of autonomous agents. It is a **three-layer supervised system**:

1. **Deterministic Discovery Layer**
   - Uses scripts/tools to generate file manifests, route maps, import references, and target search results.
   - Agents do not brute-force read large directories.

2. **Reasoning Layer**
   - Controller Agent
   - Path Audit Agent
   - Contract Drift Agent
   - Risk Audit Agent
   - Evidence Agent

3. **Verification Layer**
   - Re-run targeted checks after fixes
   - Validate proof
   - Mark findings `OPEN`, `FIXED`, or `VERIFIED`

#### 2. Execution Environment
Phase 1 runs **locally against the repository**, not in CI.

Why:
- easier debugging
- fewer time/memory limits
- safer until templates stabilize

#### 3. Controller Agent Responsibilities
The Controller is not just a router. It must:
- issue task packets
- validate worker output quality
- reject invalid packets and retry once
- reconcile duplicates and contradictions
- track coverage and missing proof
- apply the exceptions ledger
- issue a readiness review

#### 4. Worker Agent Rules
All workers must:
- stay inside assigned scope
- use approved decisions + exceptions ledger
- return structured outputs only
- include literal proof (exact lines/snippets/logs)
- include coverage report
- avoid policy decisions

#### 5. Shared Task Packet Schema
Each task packet must include:
- task id
- template version
- objective
- included scope
- excluded scope
- approved decisions
- exceptions ledger
- coverage requirement
- completion criteria
- stop conditions
- escalation conditions
- output schema version

#### 6. Shared Finding Schema
Each finding must include:
- item id
- root cause category
- technical severity
- business impact
- confidence
- execution state (`active | orphaned | unknown`)
- primary object
- affected objects
- rule violated
- finding
- recommended action
- verification method
- closure evidence required
- requires founder decision
- literal proof

#### 7. Coverage Report Requirement
Every worker output must include:
- files analyzed
- discovery inputs used
- excluded areas
- coverage confidence
- unresolved uncertainty

No `items_found = 0` result is valid without a coverage report.

#### 8. Severity Bounds
Workers may assign `Critical` or `High` only if the finding threatens:
- data integrity
- financial state correctness
- tenant isolation
- canonical revenue flow integrity

#### 9. Evidence Agent Modes
The Evidence Agent has two modes:
- **Preflight Mode**: define proof required before execution
- **Packaging Mode**: collect logs, IDs, structured outputs after execution

Screenshots are not PASS/FAIL truth.

#### 10. Verification Loop
The framework closes work using this loop:
1. Find issue
2. Create register item
3. Apply fix
4. Re-run targeted verification
5. Validate proof
6. Mark `VERIFIED` or return to `OPEN`

#### 11. Readiness Review
The Controller must issue one of:
- `NOT_READY`
- `CONDITIONALLY_READY`
- `READY_FOR_NEXT_PILLAR`

---

### PEER REVIEW — CRITIQUE OF DRAFT v1

#### What is strong
- It correctly separates search from reasoning.
- It upgrades the controller into a validator.
- It introduces verification and readiness instead of stopping at discovery.
- It controls severity inflation and silent-failure risk.

#### What is weak or incomplete
1. **No explicit retry budget at worker level**
   - Controller retries once, but workers are not required to explain why the first run failed.
2. **No contradiction protocol detail**
   - Contradictions are mentioned but not yet operationalized.
3. **No flow-tracing directive**
   - File-level findings are not enough for state-machine workflows.
4. **No adjacent-risk containment**
   - Workers need a place to note nearby issues without polluting primary findings.
5. **No output provenance**
   - Results need packet ID, repo snapshot/timestamp, and template version to be replayable.

#### Peer-review fixes required
- Add reject reason codes
- Add contradiction handling rules
- Add flow-tracing directive
- Add optional adjacent-risk section
- Add provenance metadata to all outputs

---

### PRESSURE TEST — FAILURE MODES

#### Failure Mode 1: Controller becomes a bottleneck
If controller validation is too manual or too broad, the system slows to a crawl.

**Mitigation**
- Use explicit reject reason codes:
  - `PROOF_MISSING`
  - `SCHEMA_INVALID`
  - `COVERAGE_INSUFFICIENT`
  - `SCOPE_VIOLATION`
  - `CONTRADICTION_UNRESOLVED`

#### Failure Mode 2: Workers miss cross-file state drift
A status mutation may begin in one file and terminate in another.

**Mitigation**
- Add flow-tracing rule:
  - If an entry point to a workflow is found, the worker must trace downstream state mutation/update paths until termination or uncertainty.

#### Failure Mode 3: Repeat noise from known exceptions
Workers will keep flagging accepted deviations.

**Mitigation**
- Every packet must carry an exceptions ledger.
- Findings matching approved exceptions must be classified `known_exception`, not fresh gap.

#### Failure Mode 4: False completeness
“No issues found” may hide shallow analysis.

**Mitigation**
- Require coverage map + files analyzed + discovery inputs.
- No zero-findings packet accepted without coverage review.

#### Failure Mode 5: Token/cost bloat
Large repo scans through LLM context will be wasteful and brittle.

**Mitigation**
- Deterministic manifest generation first.
- Agents only analyze targeted subsets.

#### Failure Mode 6: Severity inflation
Workers may over-rank weak findings.

**Mitigation**
- Critical/High bounded to core harms only.
- Separate `technical severity` from `business impact`.

#### Failure Mode 7: Audit without closure
Framework could become a finding machine, not a working-product system.

**Mitigation**
- Verification loop is mandatory.
- Readiness review blocks movement to next pillar.

---

### FINAL — HARDENED FRAMEWORK v2

#### A. Architecture
This system is a **supervised verification and execution framework**, not a freeform agent network.

It consists of:
1. **Deterministic Discovery Layer**
2. **Supervised Reasoning Layer**
3. **Verification + Readiness Layer**

#### B. Environment
- Run locally for Phase 1
- Use scripts/search tools to prepare manifests
- Promote selected checks to CI only after templates stabilize

#### C. Controller Authority
The Controller has authority to:
- route
- validate
- reject
- retry once
- reconcile
- cluster by root cause
- honor exceptions
- require coverage
- issue readiness status

#### D. Reject / Retry Protocol
If a worker output is invalid, the Controller must reject with one reason code:
- `PROOF_MISSING`
- `SCHEMA_INVALID`
- `COVERAGE_INSUFFICIENT`
- `SCOPE_VIOLATION`
- `CONTRADICTION_UNRESOLVED`

The task is retried once.
If it fails again:
- mark `FAILED_HUMAN_REVIEW_REQUIRED`

#### E. Required Task Packet Fields
- packet id
- template version
- repo snapshot or timestamp
- objective
- included scope
- excluded scope
- approved decisions
- exceptions ledger
- discovery inputs/manifests
- coverage requirement
- completion criteria
- stop conditions
- escalation conditions
- output schema version

#### F. Required Worker Output Fields
- packet id
- template version
- repo snapshot or timestamp
- summary
- findings
- coverage report
- adjacent risks (optional)

#### G. Required Finding Fields
- item id
- root cause category
- technical severity
- business impact
- confidence
- execution state
- primary object
- affected objects
- rule violated
- finding
- recommended action
- verification method
- closure evidence required
- requires founder decision
- literal proof with exact lines/snippets/logs

#### H. Contradiction Handling
If workers conflict:
- controller preserves both findings
- marks `conflict_open`
- triggers targeted re-audit
- does not collapse conflict into a synthetic statement without proof

#### I. Flow-Tracing Directive
Workers auditing lifecycle/state issues must trace:
- entry point
- downstream state mutation
- termination state
- uncertainty boundary if tracing cannot continue

#### J. Evidence Rules
Evidence Agent uses structured artifacts only:
- logs
- IDs
- event outputs
- test JSON
- database outputs

Screenshots may supplement, but cannot determine PASS/FAIL.

#### K. Severity Rules
`Critical` or `High` allowed only when tied to:
- data integrity
- money state correctness
- tenant isolation
- accepted revenue-flow invariant breach

#### L. Zero-Findings Rule
A packet returning no issues must still provide:
- files analyzed
- manifests used
- excluded scope
- coverage confidence
- unresolved uncertainty

Without that, the packet is invalid.

#### M. Verification Loop
`OPEN → FIX_ATTEMPTED → VERIFIED` is the only valid closure path.

#### N. Readiness Gate
The Controller must issue one status at the end of a run:
- `NOT_READY`
- `CONDITIONALLY_READY`
- `READY_FOR_NEXT_PILLAR`

Movement to the next pillar is blocked if unresolved critical findings remain.

---

## FAILURE PREVENTION LAYER (OVERLAY)

### Purpose
Ensure the system remains **field-resilient** under real-world conditions while preserving strict invariants.

### Rules (Non-Negotiable)
1. **Controlled Flexibility**
   - Custom line items allowed but must be flagged (`custom=true`) with required reason.
   - Pricing guardrails still apply; overrides are logged.

2. **Flags over New Statuses**
   - No new primary statuses.
   - Use secondary flags (e.g., `requires_return_visit`, `partial_complete`, `reschedule_pending`).

3. **Manual Fallback Paths (Auditable)**
   - Temporary/manual acceptance allowed only with:
     - actor, source (phone/email), timestamp
     - audit event recorded

4. **Offline-Safe Commits**
   - Local commit record required if offline.
   - Visible `NOT_SYNCED` state.
   - Retry with idempotency key until success.

5. **Language Alignment**
   - All customer-facing text must originate from the Service Language Library.
   - No ad hoc descriptions in TIS, Quote, Invoice, or Completion.

### Additional Safeguards
- **Pre-Commit Gate (TIS Close)**
  - Block commit unless: findings, photos, tier, pricing snapshot, signature, fulfillment mode are present.
- **No Floating Decision Invariant**
  - No accepted state without job creation, pricing snapshot, and acceptance record.
- **Observability**
  - Emit `commit_attempt`, `commit_success`, `commit_fail` with `session_id`.

---

## PILLAR 1 — RESTATED (EXECUTION FOCUS)

### What We Are Doing
We are **locking the Command-Center** so there is **one and only one** way work flows through the system:

**Quote → Accept → Job → Invoice → Payment → Completion → Documents**

### What This Means Practically
- Remove all competing estimate/quote paths.
- Enforce one status contract across UI, DB, and services.
- Ensure only the invoice can mutate money state.
- Require completion artifacts before `completed`.
- Eliminate tenant/auth fallback risks.
- Produce evidence that the entire loop works end-to-end.

### Acceptance Criteria (Must PASS)
1. Accepted quote always creates exactly one job (idempotent).
2. Payment can only be recorded via invoice path.
3. No invalid status transitions are possible.
4. Jobs cannot be completed without required artifacts.
5. All actions are traceable via events and IDs.

### Evidence Required
- Full money-loop run (IDs + logs)
- Screenshots of blocked invalid actions
- Event logs for commit/payment flows

### What We Are NOT Doing
- Not building new features
- Not touching POS
- Not designing TIS UI yet
- Not adding new statuses or alternate flows

### Outcome
A **provably correct, enforced revenue pipeline** that can safely receive field commits from TIS.

---

## PILLAR 1 GAP REGISTER (DRAFT → PEER REVIEW → PRESSURE TEST → FINAL)

---

### DRAFT v1 — GAP REGISTER

#### Category: Quote Path Fragmentation
- ID: P1-GR-001
- Issue: Non-canonical estimate/quote entry points still exist
- Severity: High
- Business Impact: Reporting drift, training confusion, broken TIS handoff
- Root Cause: Legacy paths not deprecated
- Required Fix: Disable or redirect all non-`quotes` creation paths
- Verification: Attempt to create quote via all routes → only `quotes` succeeds
- Evidence Required: route map + blocked attempts

#### Category: Status Contract Drift
- ID: P1-GR-002
- Issue: Job statuses used outside approved doctrine
- Severity: High
- Business Impact: Pipeline inconsistency, reporting corruption
- Root Cause: Implementation drift vs contract
- Required Fix: Align all status writes to approved set
- Verification: Scan codebase for invalid statuses → none present
- Evidence Required: search output + runtime validation

#### Category: Financial Write Path Risk
- ID: P1-GR-003
- Issue: Multiple potential write paths to payment state
- Severity: Critical
- Business Impact: Financial inconsistency, audit failure
- Root Cause: Lack of enforced canonical writer
- Required Fix: Restrict payment mutation to invoice-owned flow
- Verification: Attempt alternate write → blocked
- Evidence Required: code references + blocked mutation logs

#### Category: Completion Gate Weakness
- ID: P1-GR-004
- Issue: Jobs can be marked complete without required artifacts
- Severity: High
- Business Impact: Quality failure, trust erosion
- Root Cause: Missing enforcement layer
- Required Fix: Enforce checklist + photos + confirmation
- Verification: Attempt completion without artifacts → blocked
- Evidence Required: UI/API test + logs

#### Category: Tenant/Auth Exposure
- ID: P1-GR-005
- Issue: Tenant fallback or service-role overreach possible
- Severity: Critical
- Business Impact: Data leakage, security breach
- Root Cause: Improper auth boundaries
- Required Fix: Remove fallback and tighten scope
- Verification: Attempt cross-tenant access → denied
- Evidence Required: auth logs + test case

#### Category: Evidence Gap
- ID: P1-GR-006
- Issue: No complete money-loop proof exists
- Severity: Critical
- Business Impact: False confidence in system readiness
- Root Cause: No structured validation runs
- Required Fix: Execute full loop and capture artifacts
- Verification: Quote → Payment → Completion run recorded
- Evidence Required: IDs, logs, event traces

---

### PEER REVIEW — CRITIQUE OF DRAFT v1

#### Strengths
- Focuses on true pipeline blockers
- Aligns with invariants
- Keeps scope tight to Pillar 1

#### Weaknesses
1. Missing root-cause grouping across items
2. No dependency mapping (order of fixes unclear)
3. No coverage requirement per item
4. No execution-state awareness (active vs dead code)
5. No exception handling

#### Required Improvements
- Add dependency chain
- Add coverage requirement
- Add execution state classification
- Add exception ledger reference

---

### PRESSURE TEST — FAILURE MODES

#### Failure Mode 1: Fix order confusion
Without dependencies, teams may fix items out of order.

Mitigation:
- Add dependency field

#### Failure Mode 2: Hidden duplicate issues
Same root cause appears in multiple items.

Mitigation:
- Add root cause category

#### Failure Mode 3: False closure
Fix applied but not verified properly.

Mitigation:
- Enforce verification method + evidence

#### Failure Mode 4: Missed scope
Agents miss parts of repo.

Mitigation:
- Add coverage requirement per item

---

### FINAL — HARDENED GAP REGISTER v2

Each item must include:
- ID
- Root Cause Category
- Severity (technical + business)
- Execution State (active/orphaned/unknown)
- Dependency
- Description
- Required Fix
- Verification Method
- Coverage Requirement
- Evidence Required
- Exception Check

---

## PILLAR 1 — FIRST 3 TASK PACKETS (HARDENED)

---

### TASK PACKET 1 — PATH AUDIT

```json
{
  "packet_id": "P1-TP-001",
  "template": "path_audit",
  "template_version": "1.0",
  "pillar": "pillar_1",
  "repo": "command-center",
  "repo_snapshot": "local_run_required",
  "objective": "Find all active non-canonical quote/estimate creation or acceptance paths that violate the approved revenue flow.",
  "included_scope": [
    "src/",
    "supabase/functions/",
    "docs/"
  ],
  "excluded_scope": [
    "node_modules/",
    "dist/",
    "coverage/",
    "archived/",
    "deprecated/ if confirmed unreachable"
  ],
  "discovery_inputs": [
    "route manifest",
    "import graph for quote/estimate pages and services",
    "grep results for quote/estimate/create/accept/send terms",
    "function manifest for supabase/functions"
  ],
  "approved_decisions": {
    "canonical_quote_path": "quotes_only",
    "accepted_quote_requires_job": true,
    "send_estimate_scope": [
      "send",
      "mark_sent",
      "emit_event",
      "optional_follow_up_task"
    ],
    "high_critical_bounds": [
      "data_integrity",
      "financial_state",
      "tenant_isolation",
      "revenue_flow_integrity"
    ]
  },
  "exceptions_ledger": [],
  "target_gap_ids": [
    "P1-GR-001",
    "P1-GR-007"
  ],
  "coverage_requirement": "Must inspect all active routes, services, edge functions, and docs touching quote/estimate creation, acceptance, and send behavior. No zero-findings result valid without files_analyzed list and route coverage summary.",
  "completion_criteria": [
    "All active quote/estimate entry points identified",
    "All acceptance paths identified",
    "All non-canonical paths classified as active/orphaned/unknown",
    "All findings mapped to rule violated"
  ],
  "stop_conditions": [
    "All reachable quote/estimate creation and acceptance paths traced to termination or uncertainty boundary",
    "Coverage report complete"
  ],
  "escalation_conditions": [
    "Dynamic route or path cannot be resolved",
    "Conflicting docs vs implementation",
    "Unclear execution state"
  ],
  "worker_rules": [
    "Do not propose a new canonical path",
    "Do not assign High/Critical unless revenue flow integrity is threatened",
    "Use literal proof with exact file paths and line references or snippets",
    "Trace from entry point to downstream mutation/termination where applicable"
  ],
  "required_output": {
    "schema": "worker_output_v1",
    "must_include": [
      "summary",
      "findings",
      "coverage_report",
      "adjacent_risks_optional"
    ]
  },
  "reject_if": [
    "proof_missing",
    "schema_invalid",
    "coverage_insufficient",
    "scope_violation",
    "contradiction_unresolved"
  ]
}
```

---

### TASK PACKET 2 — CONTRACT DRIFT AUDIT

```json
{
  "packet_id": "P1-TP-002",
  "template": "contract_drift",
  "template_version": "1.0",
  "pillar": "pillar_1",
  "repo": "command-center",
  "repo_snapshot": "local_run_required",
  "objective": "Detect mismatches between approved Pillar 1 doctrine and actual implementation across statuses, lifecycle transitions, send-estimate behavior, and completion requirements.",
  "included_scope": [
    "src/",
    "supabase/functions/",
    "docs/",
    "supabase/migrations/ if status constraints exist"
  ],
  "excluded_scope": [
    "node_modules/",
    "dist/",
    "coverage/",
    "confirmed orphaned files"
  ],
  "discovery_inputs": [
    "approved doctrine sheet",
    "STATUS_CONTRACTS.md or equivalent",
    "grep results for all status strings",
    "grep results for send-estimate/send-invoice completion-related logic",
    "manifest of lifecycle mutation functions"
  ],
  "approved_decisions": {
    "job_statuses": [
      "new",
      "scheduled",
      "dispatched",
      "in_progress",
      "completed",
      "cancelled",
      "on_hold"
    ],
    "send_estimate_scope": [
      "send",
      "mark_sent",
      "emit_event",
      "optional_follow_up_task"
    ],
    "completion_requirements": [
      "checklist",
      "before_photos",
      "after_photos",
      "technician_confirmation",
      "completion_summary"
    ],
    "flags_not_statuses": true,
    "accepted_quote_requires_job": true
  },
  "exceptions_ledger": [],
  "target_gap_ids": [
    "P1-GR-002",
    "P1-GR-004",
    "P1-GR-007",
    "P1-GR-009"
  ],
  "coverage_requirement": "Must compare doctrine to active implementation across UI, services, edge functions, and docs. Must include all discovered status writers and transition points.",
  "completion_criteria": [
    "All non-approved statuses identified",
    "All send-estimate scope violations identified",
    "All completion requirement enforcement gaps identified",
    "Transition drift documented with proof"
  ],
  "stop_conditions": [
    "All active status writes traced",
    "All relevant lifecycle mutation points reviewed",
    "Coverage report complete"
  ],
  "escalation_conditions": [
    "Doctrine ambiguity blocks classification",
    "Same object has conflicting status rules across layers",
    "Runtime-enforced status cannot be located in static code"
  ],
  "worker_rules": [
    "Do not invent new statuses",
    "Treat undocumented status writes as drift unless present in exceptions ledger",
    "Use literal proof with file path plus line/snippet",
    "Separate technical severity from business impact"
  ],
  "required_output": {
    "schema": "worker_output_v1",
    "must_include": [
      "summary",
      "findings",
      "coverage_report",
      "adjacent_risks_optional"
    ]
  },
  "reject_if": [
    "proof_missing",
    "schema_invalid",
    "coverage_insufficient",
    "scope_violation",
    "contradiction_unresolved"
  ]
}
```

---

### TASK PACKET 3 — RISK AUDIT

```json
{
  "packet_id": "P1-TP-003",
  "template": "risk_audit",
  "template_version": "1.0",
  "pillar": "pillar_1",
  "repo": "command-center",
  "repo_snapshot": "local_run_required",
  "objective": "Find active risks that threaten financial state correctness, tenant isolation, auditability, idempotency, and canonical revenue-flow enforcement.",
  "included_scope": [
    "src/",
    "supabase/functions/",
    "docs/",
    "scripts/ if they mutate or verify revenue flow"
  ],
  "excluded_scope": [
    "node_modules/",
    "dist/",
    "coverage/",
    "test fixtures unless they define runtime behavior"
  ],
  "discovery_inputs": [
    "manifest of invoice/payment/work-order mutation functions",
    "grep results for admin client / service role / tenant fallback usage",
    "grep results for idempotency keys / retry logic / event emission",
    "event schema or event log docs if present"
  ],
  "approved_decisions": {
    "invoice_is_money_truth": true,
    "payment_mutation_via_invoice_only": true,
    "accepted_quote_requires_job": true,
    "high_critical_bounds": [
      "data_integrity",
      "financial_state",
      "tenant_isolation",
      "revenue_flow_integrity"
    ],
    "manual_fallbacks_must_be_auditable": true
  },
  "exceptions_ledger": [],
  "target_gap_ids": [
    "P1-GR-003",
    "P1-GR-005",
    "P1-GR-008",
    "P1-GR-009",
    "P1-GR-010"
  ],
  "coverage_requirement": "Must review all active money-state mutation paths, tenant/auth-sensitive endpoints, event emission points, and idempotency/retry logic. No zero-findings result valid without files_analyzed and mutation-path summary.",
  "completion_criteria": [
    "All payment/state mutation paths classified",
    "All tenant fallback or service-role risks identified",
    "All missing event emission points identified for critical actions",
    "All idempotency gaps identified for accept/payment/commit actions"
  ],
  "stop_conditions": [
    "All active mutation points traced to authoritative writer or uncertainty boundary",
    "Tenant/auth-sensitive surfaces reviewed",
    "Coverage report complete"
  ],
  "escalation_conditions": [
    "Possible cross-tenant exposure cannot be proven statically",
    "Mutation path behavior depends on runtime secret/config not visible",
    "Idempotency behavior unclear without runtime logs"
  ],
  "worker_rules": [
    "Do not assign Critical or High without explicit tie to money state, tenant isolation, data integrity, or accepted revenue-flow breach",
    "Use literal proof with exact file path plus line/snippet/log reference",
    "Classify execution state as active, orphaned, or unknown",
    "Trace risk across entry point, mutation point, and termination where applicable"
  ],
  "required_output": {
    "schema": "worker_output_v1",
    "must_include": [
      "summary",
      "findings",
      "coverage_report",
      "adjacent_risks_optional"
    ]
  },
  "reject_if": [
    "proof_missing",
    "schema_invalid",
    "coverage_insufficient",
    "scope_violation",
    "contradiction_unresolved"
  ]
}
```

---

## CONTROL SUMMARY
- Phase: STABILIZE
- Critical Path: Command-Center → Handoff
- Premature: POS
- Bottleneck: Missing lock + contract
- Next Move: Execute Pillar 1 gap register and produce evidence

