# ML-P1 Minimum Money-State Design Contract

> Planning correction artifact. **Does not authorize implementation by itself.**
> Stripe payment processing is **in V1** (slice **S5b**). Autonomous follow-up is
> **in V1** (slice **S6**). See `BHFOS_V1_V2_PRODUCT_BOUNDARY.md` and roadmap.

Canonical loop: **lead → quote → accept → job (×1) → invoice → payment → receipt/close**.

---

## 1. Canonical quote/estimate path

- **New work** uses `quotes` (and `quote_items`) only.
- Legacy `estimates` create/update on the Phase 1 path is **forbidden** (server DENY + UI freeze).
- Read-only legacy display may remain until cleanup; must not convert to job via non-canonical path.

## 2. Quote states (minimum)

| State | Meaning |
| --- | --- |
| `draft` | Editable; not customer-binding |
| `issued` | Presented to customer; version frozen for that issue |
| `approved` | Customer accepted a specific issued version |
| `rejected` | Customer declined |
| `expired` | Past validity without approval |
| `revised` | Superseded by a new draft/issue from prior version |

Rules:

- Transition matrix must be enforced server-side.
- **No silent edit** of `issued` or `approved` content; changes require new revision (new version id).
- Approval records: timestamp, approver identity (customer/user), method (e.g. public accept link), approved amount, **quote version id**.

## 3. Approved-record immutability

- Approved quote version is immutable.
- Discounts, taxes, fees, deposits, adjustments on that version are explicit line/total fields — not free-text only.
- Cancellation/override of approval requires reason code + authorized role.

## 4. Quote version pinning

- Job and invoice created from an approval must store `source_quote_id` + `source_quote_version` (or equivalent immutable snapshot id).
- Line items carry lineage to quote lines (ids or stable keys).

## 5. Accept → job idempotency

- One acceptance path creates **exactly one** job.
- Retries / double-submit return the same job id (idempotency key = accept event / quote version).
- Duplicate `JobCreated` **jobs** are defects; duplicate events alone require metric caveat + fix.

## 6. Job → invoice lineage

- Invoice lines descend from job scope which descends from approved quote version.
- Partial completion: only completed authorized scope may invoice; remainder stays open or change-ordered (minimal rule: no silent drop).
- Additional work outside approved scope requires explicit additional authorization (minimal change-order flag or new quote) — not silent add to approved version.

## 7. Duplicate prevention

- Idempotency keys on: quote accept, job create, invoice issue, (future) payment intent.
- Unique constraints where feasible (e.g. one open job per approved quote version).

## 8. Minimal authorized job-state transitions

Phase 1 does **not** require full field FSM. Minimum for lock path:

- Document **authorized** transitions used by P1 (at least: create-from-accept → … → completable state → completed / cancelled).
- **Ratify** live two-layer model as Appendix A-equivalent (see DR resolution): dispatch status writable; operational stage derived — do not collapse to three-state toy model.
- Technician identity recorded on completion-relevant transitions when P1 path uses them.
- Cancellation / no-access: explicit states or reason codes; no delete-without-audit.
- Completion is idempotent (no double-complete).

## 9. Invoice states and immutability

| State | Meaning |
| --- | --- |
| `draft` | Editable |
| `issued` | Customer-facing; **immutable** amounts/lines |
| `voided` | Cancelled issued invoice with reason code + authority |
| `paid` | Settled per canonical payment writer (including partial allocation rules later) |

- Issued invoice history immutable; corrections via void+reissue or adjustment records with reason codes — **no silent mutation**.
- Invoice numbering: documented rule (sequence per tenant or system) — no reusable numbers for distinct issued invoices.

## 10. Void / correction reason codes

- Required on void, forced status correction, approval override, and cancellation of in-flight money records.
- Free-text optional; reason **code** mandatory.

## 11. Tenant and role authorization matrix (minimum)

| Capability | Office | Technician | Manager | Admin |
| --- | --- | --- | --- | --- |
| Create/edit draft quote | Yes | Per policy | Yes | Yes |
| Issue quote | Yes | Per policy | Yes | Yes |
| Approve (customer path) | Customer token / designated | — | — | Break-glass only + reason |
| Accept→job (system) | Via canonical accept | — | — | No bypass UI-only |
| Complete job (P1 path) | Yes | Yes (assigned) | Yes | Yes |
| Issue invoice | Yes | No default | Yes | Yes |
| Void invoice | No | No | Yes + reason | Yes + reason |
| Mark paid | **Canonical writer only** | No | No | No (except break-glass + reason + audit) |
| Shared multi-tenant / cross-tenant access | **NOT APPLICABLE** — V2 is dedicated instance per company; shared multi-tenancy removed | — | — | — |

**V1 note:** BHFOS V1 is single-company for The Vent Guys. §11 is **internal role**
authorization. **V2 note:** White-label dedicated instances — not shared-tenant RLS.
See `BHFOS_V1_V2_PRODUCT_BOUNDARY.md`.

UI hiding is **not** authorization. Every money-state action authorized server-side.

## 12. Server-side deny-by-default

- Unknown transition → DENY.
- Missing actor → DENY.
- Missing or malformed **TVG company/tenant context** → DENY (single-company integrity).
- Agent- or client-supplied context override that bypasses session → DENY.
- No admin silent context fallback on money-state endpoints.
- Shared multi-tenant cross-org DENY suites → **NOT APPLICABLE** under current V1/V2 model.

## 13. Minimum audit event fields

Every material money-state change records:

- `event_id`
- `record_id` (and record type)
- `tenant_id`
- `actor_id`
- `actor_role`
- `timestamp`
- `previous_state`
- `new_state`
- `reason` / reason_code (when required)
- `source_action`
- `correlation_id` / transaction id
- `success` | `failure`
- related `quote_id` / `quote_version` / `job_id` / `invoice_id` / customer/lead id as applicable

High-value history should be append-only (events not overwritten).

## 14. Rollback and atomicity

- Accept→job(+required events) is one atomic unit or equivalent transactional outbox.
- Invoice issue from job scope atomic with lineage writes.
- On failure: no partial money state; user-visible error; safe retry.

## 15. Retry and concurrency

- Idempotent handlers for accept, job create, invoice issue.
- Optimistic concurrency or equivalent on quote/invoice version rows.
- Duplicate-event protection for future webhooks (design now).

## 16. Payment / Stripe (V1 in scope — slice placement separate)

**Product authority:** Stripe payment processing is **in V1** (`BHFOS_V1_V2_PRODUCT_BOUNDARY.md`).
Earlier “no live pay in Phase 1” planning language is **superseded**.

Design and implementation must support (minimum operational V1):

- payment initiation and status  
- payment confirmation  
- failed payment handling  
- duplicate payment protection  
- webhook idempotency  
- reconciliation  
- refunds or void handling at minimum operational level  
- audit history  
- customer communication  
- failure escalation  

Public-pay + webhook spine already exists in code; gaps must be closed before V1
freeze / USABLE. New payment code still requires normal Founder auth per PR/SHA.

Also preserve readiness for (may deepen after minimum):

- partial payments, deposits, credits  
- payment allocation detail  
- provider webhook retries (already partially present)

## 17. Explicitly not required in Phase 1

- Full Housecall-Pro-equivalent dispatch FSM
- Full offline sync engine
- Full change-order product suite beyond minimal additional-work rule
- Multi-currency, complex tax engines beyond current explicit fields
- Payment provider expansion
