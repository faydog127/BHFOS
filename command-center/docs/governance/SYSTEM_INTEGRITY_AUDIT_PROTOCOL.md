# System Integrity Audit Protocol (ULSIA + RVH)

Objective: prevent loose work by enforcing **when to audit**, **how to prove**, and **how fixes are closed**.

This repo uses two protocols:
- **ULSIA** = Unified Layered System Integrity Audit (static truth)
- **RVH** = Runtime Validation Harness (dynamic proof)

---

## 1) ULSIA purpose

ULSIA proves:
- canonical schema truth (migrations are source-of-truth)
- code ↔ schema alignment (drift detection)
- route/function existence + contracts
- cross-system dependency mapping

ULSIA output is **evidence-first** and produces fix candidates, not broad refactors.

## 2) RVH purpose

RVH proves:
- end-to-end runtime behavior of critical chains
- idempotency/replay safety (where applicable)
- DB state transitions match expectations
- evidence artifacts exist for every run

RVH is the closure mechanism for high-risk fixes (especially P0).

---

## 3) When to use ULSIA

Run ULSIA when:
- a system feels “half working” (workflow integrity concern)
- you see schema/query/runtime errors (e.g., missing columns, RPC failures)
- production behavior is inconsistent with local
- new integrations are added (Stripe, Resend, n8n, Drive, Calendar, TIS sync)
- before any stabilization sprint begins
- after significant migrations or edge-function changes

ULSIA is also the default starting point if the problem scope is unclear.

## 4) When to use RVH

Run RVH when:
- validating a critical chain end-to-end (P0/P1)
- closing a fix packet (especially anything that touches money or scheduling)
- testing replay/idempotency behavior (webhooks, payment initiation)
- confirming that “it should work” actually **does work** in runtime

RVH is not optional for P0 closure.

---

## 5) Stop/wait gates

To avoid runaway audits and context flooding, both protocols must respect stop/wait gates.

### ULSIA gates

ULSIA runs in phases. At minimum:
1) **Artifacts Phase** (inventory + dumps + lists)
   - STOP. Output artifact index. Wait for explicit “PROCEED”.
2) **Drift + Findings Phase**
   - STOP. Output triage table + drift report. Wait for explicit “PROCEED”.
3) **Reconciliation Phase**
   - STOP. Output dependency map + fix order. Wait for explicit approval to create fix packets.

### RVH gates

RVH runs chain-by-chain:
- Preflight gates must pass before any writes.
- STOP on first P0 failure per chain.
- Do not proceed to the next chain until the current chain is PASS or explicitly deferred.

---

## 6) Evidence standards

Evidence must be traceable and minimal.

### What counts as evidence

- file path + line reference (repo evidence)
- migration name + statement excerpt (schema evidence)
- command output snippet (runtime evidence)
- artifact path under `tmp/` (run evidence)

### What does not count

- “feature exists in code”
- “seems correct”
- screenshots without a trace tuple (unless explicitly a UX-only check)

### Redaction

- Do not store secrets, tokens, or PII in artifacts.
- Use redacted formats (first4…last4) for tokens/keys.

RVH evidence requirements are defined in:
- `docs/runtime-validation/evidence-spec.md`

---

## 7) Blocked-state rules

If blocked by:
- missing secrets/auth
- missing contracts/source-of-truth
- unavailable service
- environment ambiguity (prod vs local vs staging)

Then do only:
1) record BLOCKED + evidence
2) propose minimum unblock step
3) stop (no scope expansion)

---

## 8) Output requirements

### ULSIA output (minimum)

- top system truths (top 5)
- triage table: Issue, Severity, Evidence, Root cause, Scope boundary, Smallest remediation, Validation
- drift report (schema vs migrations vs code)
- dependency map (what blocks what)
- fix order (P0 → P1 → P2)
- “must verify at runtime” list

### RVH output (minimum)

For each run:
- run log entry (copy format from `docs/runtime-validation/run-log.md`)
- artifact folder path
- PASS/FAIL/BLOCKED with first failure point
- evidence tuple (redacted)
- teardown record (LOCAL/STAGING only)

---

## 9) Relationship between audit findings and fix packets

Rule: no fix is “real” until it is captured as a fix packet.

Process:
1) ULSIA or RVH produces a finding (with evidence)
2) Create a fix packet using:
   - `docs/handoff/FIX_PACKET_TEMPLATE.md`
3) Fix packet defines:
   - exact scope
   - exact proposed change
   - validation steps (ULSIA checks + RVH chains)
   - rollback plan
4) Only after validation is PASS can the packet be marked closed

---

## 10) Closure rule (non-negotiable)

**Every P0 fix must be validated by RVH before closure.**

Definition of validated:
- RVH automated trace for the affected chain passes in LOCAL
- and passes in STAGING (once staging exists)
- PROD remains read-only unless explicitly approved

If staging does not exist:
- P0 fixes may be marked “Validated-Local” but not “Released” unless the risk is explicitly accepted.

