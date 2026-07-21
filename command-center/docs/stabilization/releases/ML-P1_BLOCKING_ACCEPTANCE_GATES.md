# ML-P1 Blocking Acceptance Gates

> Planning correction artifact. **Does not authorize implementation.**
> A Phase 1 implementation slice may not be declared PASS / USABLE unless all
> gates below are met or an individual gate is waived by **separate Founder
> residual-risk acceptance** naming the gate ID and expiry.

CI green ≠ USABLE.

---

## G-01 — Lineage completeness

**Require:** 100% quote/estimate→job→invoice lineage on authorized Phase 1 test transactions.

**Proof:** Stable IDs + approved quote version pin from quote → job scope → invoice lines; queryable join report with zero breaks.

**Fail:** Any missing link, wrong version, or re-keyed amounts without lineage.

## G-02 — Audit-event completeness

**Require:** 100% of required money-state transitions emit audit events with minimum fields from the Money-State Design Contract.

**Proof:** Event extract for the test set; field checklist 100%.

**Fail:** Any required transition without complete event.

## G-03 — Authorization negatives (V1 single-company)

**Authoritative product decision:** BHFOS V1 operates for **The Vent Guys** only.
**V2** is white-label **dedicated instance per company**. **Shared multi-tenancy
is removed from V2 scope.** Cross-tenant isolation suites are **NOT APPLICABLE**
to V1 or to V2 Money Loop acceptance.

**V1 require:**

- Unauthenticated access to money-path actions → **DENY**
- Unauthorized **internal role** for the action (Money-State §11) → **DENY**
- Missing or malformed TVG company/tenant context on money writes → **DENY**

**V1 proof:** Automated negatives for the three cases above; zero unauthorized successes.

**V1 fail:** Any unauthorized success on those V1 cases.

**Explicitly not required (V1 or V2 Money Loop):** Cross-tenant / shared-multi-tenant RLS negative suites; tenant-switching tests.

**V2 instance platform (separate from Money Loop gates):** Dedicated-instance isolation is achieved by **separate deployment + data environment**, not shared-tenant RLS. Ops readiness for instance isolation is tracked under dedicated-instance operations — not G-03 cross-tenant.

## G-04 — Duplicate job/invoice under retry

**Require:** Zero duplicate jobs or invoices under repeated-click and retry tests.

**Proof:** Double-submit / retry harness on accept and invoice issue.

**Fail:** Second job or invoice created.

## G-05 — No silent partial transactions

**Require:** Zero silent partial transactions under forced-failure tests.

**Proof:** Inject failure mid accept→job→events (and invoice issue); assert rollback or explicit compensating failure; no half-committed money state.

**Fail:** Orphan job without quote link, invoice without job, or paid flag without payment record (as applicable).

## G-06 — Mobile path without escape

**Require:** Founder and technician complete the mobile Phase 1 path without Notes, text, paper, or administrative rescue.

**Proof:** Observed real-device trials; escape diary = 0 for gate runs.

**Fail:** Any required step performed outside the app, or admin intervention required.

## G-07 — Task time caps (after baseline)

**Require:** Explicit maximum task times for: create/find customer; create estimate; complete job record; generate invoice — **published after baseline measurement**, not invented a priori.

**Proof:** Scorecard baseline window complete; caps recorded in KPI scorecard; gate trials meet caps.

**Fail:** Caps missing, or trials exceed caps without redesign.

## G-08 — Known critical issues closed or signed

**Require:** All `P1_BLOCKING` and unresolved critical items in the Known-Issue Register are **fixed** or **formally accepted** with bounded rationale, owner, and completion test.

**Proof:** Register rows updated; Founder acceptance recorded for any `DEFER_SIGNED` / waived item.

**Fail:** Critical issue unmarked or deferred with generic “later.”

## G-09 — Single money-writer invariant

**Require:** Single money-writer invariant proven.

**Proof:** Writer inventory of all paths that mutate paid/amount_paid/balance_due/invoice paid status; exactly one canonical writer; negatives for alternates.

**Fail:** Second writer can mark paid, or inventory incomplete.

## G-10 — UX/Field Workflow review bound

**Require:** Independent UX/Field Workflow review of the Phase 1 mobile path completed and findings dispositioned (fix / accept) before USABLE.

**Proof:** Review artifact linked; dispositions in register or packet.

**Fail:** Ship claim without review, or open P1_BLOCKING UX findings.

---

## Gate application

| Claim | Gates required |
| --- | --- |
| Planning docs merge | None of the above (docs-only) |
| Implementation slice merge | Tests for G-01–G-05, G-09 as applicable to slice |
| Phase 1 path USABLE | **All** G-01–G-10 |
