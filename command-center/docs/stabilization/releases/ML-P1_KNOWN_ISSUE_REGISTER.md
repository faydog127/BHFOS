# ML-P1 Known-Issue Register

> Planning correction artifact. **Does not authorize implementation.**
> Baseline planning merge: `dd7bbe3544f9f8ec016330c5f29b9d8f95f02b40` (PR #64).
> G2.3 exit baseline: `6bc8db4f46bb604c0a3e4c9631985e8314616a8d`.

Timing classes: `P1_BLOCKING` | `P1_MUST_DESIGN` | `P1_FIX_DURING` | `DEFER_SIGNED` | `HYGIENE`.

---

## KI-01 — Dual estimate systems (`estimates` vs `quotes`)

| Field | Value |
| --- | --- |
| Evidence | `V1_STABILIZATION_BACKLOG.md` B-004; `V1_SYSTEM_BASELINE.md` §9/§15; Pillar 1 P1-GR-001 |
| Affected workflow | Estimate creation, approval, estimate→job conversion |
| Risk | Orphan estimates; jobs not created; conversion metrics lie; dual writers |
| Safe to defer? | **No** for new work path policy; full UI cleanup may phase |
| Deferral rationale | N/A for path policy — new work must use `quotes` only. Legacy `estimates` UI freeze is `P1_MUST_DESIGN`; wholesale removal may be `P1_FIX_DURING` if freeze proven |
| Timing | `P1_MUST_DESIGN` (canonical path) / `P1_FIX_DURING` (disable/hide legacy create) |
| Owner | Money-loop product owner |
| Completion test | Inventory shows no new writes to `estimates` on Phase 1 path; accept→job tests use `quotes` only; dual-create attempt DENY or blocked in UI+server |

## KI-02 — Customer / property / service-address identity lineage

| Field | Value |
| --- | --- |
| Evidence | `V1_MODULE_OWNERSHIP.md`; `R1_IDENTITY_RELATIONSHIP_PLAN.md`; baseline property model |
| Affected workflow | Customer create/find, estimate address, job site, invoice address |
| Risk | Wrong site serviced; duplicate customers; broken joins |
| Safe to defer? | **Partial** — full property architecture rewrite yes; Phase 1 lineage rules no |
| Deferral rationale | Full multi-property account model (B-023) is structural V2; Phase 1 must still define authoritative lead/customer + service address for quote→pay test set |
| Timing | `P1_MUST_DESIGN` (authority rules for P1 path) / `DEFER_SIGNED` (B-023 full rewrite) |
| Owner | Data / identity owner |
| Completion test | For P1 test transactions: stable IDs link lead→quote→job→invoice; service address fields documented and non-null where required |

## KI-03 — UUID vs bigint property relationship break

| Field | Value |
| --- | --- |
| Evidence | `V1_STABILIZATION_BACKLOG.md` B-001; `V1_SYSTEM_BASELINE.md` §9 (`properties.id` bigint vs money-loop UUID) |
| Affected workflow | Property joins on estimate/job/invoice; embeds |
| Risk | Silent null joins; wrong property; payment address failures |
| Safe to defer? | **Schema rewrite: yes (signed).** **Opaque/safe access pattern: no.** |
| Deferral rationale | Structural UUID↔bigint unification is high-risk migration; Accept-in-V1 with documented pointer/fallback is existing disposition — must remain explicit, not forgotten |
| Timing | `DEFER_SIGNED` (unification) / `P1_MUST_DESIGN` (no name-based linking; document allowed join pattern) |
| Owner | Data owner + Architecture Guard on any schema change |
| Completion test | P1 tests never join on customer name; documented pattern used; no new UUID/bigint assumptions introduced |

## KI-04 — Address field mismatch (`address1` vs `address_line_1`)

| Field | Value |
| --- | --- |
| Evidence | `V1_SYSTEM_BASELINE.md` §9; R1 plans |
| Affected workflow | Customer/property display; invoices; public pay address |
| Risk | Blank/wrong address on customer-facing and field surfaces |
| Safe to defer? | **No** for P1 quote→pay path field mapping |
| Deferral rationale | N/A — mapping must be correct on canonical path; broader column rename can wait |
| Timing | `P1_MUST_DESIGN` / `P1_FIX_DURING` if code still selects wrong column |
| Owner | Money-loop implementer |
| Completion test | P1 path reads/writes hosted `address_line_1` (or documented alias); smoke shows non-empty service address |

## KI-05 — Tenant context / money-writer watch (B-003)

| Field | Value |
| --- | --- |
| Evidence | `V1_STABILIZATION_BACKLOG.md` B-003; handshake P0-01; Pillar P1-GR-003/005 |
| Affected workflow | All money-state writes; listing; admin APIs |
| Risk | **V1:** unauthorized role/unauthenticated write; missing/malformed TVG tenant context; alternate money writers. **V2:** cross-tenant exposure (multi-tenant) |
| Safe to defer? | **No** for V1 authn/role/context DENY + money-writer inventory. **Yes (signed to V2)** for multi-tenant / cross-tenant isolation |
| Deferral rationale | **Founder V1 decision:** BHFOS V1 is single-tenant TVG only. Cross-tenant isolation is V2 architecture, not ML-P1 / V1 freeze |
| Timing | `P1_BLOCKING` (authn + role + TVG context DENY + writer watch); `DEFER_SIGNED` → **V2** (cross-tenant / multi-tenant RLS) |
| Owner | Security / Architecture Guard (V1); V2 architecture owner (cross-tenant) |
| Completion test (V1) | Unauthorized-role and unauthenticated money-path negatives = DENY; missing/malformed TVG context = DENY; money-writer inventory lists exactly one paid-state writer (by S5) |
| Completion test (V2) | Automated cross-tenant read/write negatives = 0 unauthorized access when multi-tenant is authorized |

## KI-06 — Invoice vs job `payment_status` divergence (B-008)

| Field | Value |
| --- | --- |
| Evidence | `V1_STABILIZATION_BACKLOG.md` B-008; baseline §10 job operational state |
| Affected workflow | Job board, invoice truth, technician/office status |
| Risk | Board shows unpaid while invoice paid (or reverse); ops decisions wrong |
| Safe to defer? | **Unsafe to ignore**; dual-field model OK if authority documented |
| Deferral rationale | May keep two-layer display if invoice is sole money authority and job field is derived/read-only |
| Timing | `P1_MUST_DESIGN` (authority rule) / `P1_FIX_DURING` (enforce derivation or single writer) |
| Owner | Money-loop product owner |
| Completion test | After pay on P1 test: invoice authority and job-facing status agree per doctrine; no manual dual update |

## KI-07 — Alternate paid-state writers

| Field | Value |
| --- | --- |
| Evidence | Four pillars Gap Register P1-GR-003; `paymentService` vs `public-pay` notes in R1 |
| Affected workflow | Payment, invoice status, lead paid status |
| Risk | Bypass of canonical writer; duplicate/conflicted paid state |
| Safe to defer? | **No** |
| Deferral rationale | N/A — single money writer is ML-P1 invariant |
| Timing | `P1_BLOCKING` |
| Owner | Money-loop owner + Architecture Guard |
| Completion test | Inventory of code paths that set paid/amount_paid/balance; only canonical writer mutates; alternate paths DENY or removed from P1 surface |

## KI-08 — Admin auth fallback

| Field | Value |
| --- | --- |
| Evidence | Four pillars P1-GR-005 tenant/auth fallback on admin endpoints |
| Affected workflow | Server-side money-state and admin APIs |
| Risk | Authorization based on missing tenant defaults; privilege escalation |
| Safe to defer? | **No** for money-state endpoints used by P1 |
| Deferral rationale | N/A — deny-by-default required on money-state actions |
| Timing | `P1_BLOCKING` for P1 endpoints; broader admin sweep `P1_FIX_DURING` |
| Owner | Security |
| Completion test | Negative tests: missing/forged tenant or role → DENY; no silent default tenant |

## KI-09 — Technician identity gaps

| Field | Value |
| --- | --- |
| Evidence | `R1_IDENTITY_RELATIONSHIP_PLAN.md` §15 — roster missing `user_id`; no FK to `auth.users` |
| Affected workflow | Dispatch, job assignment, mobile actor on audit events |
| Risk | Wrong tech attributed; audit actor incomplete; mobile login mismatch |
| Safe to defer? | **Partial** — full FK migration may defer; P1 audit actor must be resolvable |
| Deferral rationale | Schema FK to auth.users is larger change; P1 requires actor identity on money-adjacent job actions used in acceptance path |
| Timing | `P1_MUST_DESIGN` (actor on events) / `DEFER_SIGNED` (full roster FK) |
| Owner | Identity owner |
| Completion test | P1 acceptance run records technician/actor id on job completion events; unmapped tech cannot complete P1 path silently |

## KI-10 — `tenant_id` gaps on properties / technicians

| Field | Value |
| --- | --- |
| Evidence | `V1_SYSTEM_BASELINE.md` §9 missing tenant_id on prod properties/technicians |
| Affected workflow | Tenant isolation, listings, mobile |
| Risk | Cross-tenant leakage via unscoped rows |
| Safe to defer? | **Schema backfill: signed only.** **Query scoping: no.** |
| Deferral rationale | Column backfill is migration (separate auth); application queries for P1 must still enforce tenant via lead/job/invoice which carry tenant |
| Timing | `P1_MUST_DESIGN` (enforce via money entities) / `DEFER_SIGNED` (property/tech column backfill) |
| Owner | Data + Security |
| Completion test | Negative listing/read tests cannot fetch other-tenant money entities; documented reliance on lead/job/invoice tenant |

## KI-11 — Follow-up / automation fragility

| Field | Value |
| --- | --- |
| Evidence | Backlog B-019; historical UAT invoice follow-up / `trg_money_loop_invoice_followups` repairs |
| Affected workflow | Post-invoice tasks; customer chase; automation |
| Risk | Missed follow-ups; work escapes to Notes/text; silent trigger failures |
| Safe to defer? | **Yes for full task UX**, if exceptions are visible |
| Deferral rationale | Rich follow-up product is not required to prove quote→pay; unowned silent automation failure is not acceptable — need visible failure or disable |
| Timing | `P1_FIX_DURING` (fail visible / no silent break) / `DEFER_SIGNED` (full task surface) |
| Owner | Ops automation owner |
| Completion test | Forced automation failure surfaces in exception log/queue; P1 pay path does not depend on hidden follow-up success |

## KI-12 — Incomplete event doctrine (A-LOCK PARTIAL)

| Field | Value |
| --- | --- |
| Evidence | `A_LOCK_CHECKLIST.md` minimum event set PARTIAL; Appendix A unlocked |
| Affected workflow | Audit, evidence, reconciliation |
| Risk | Cannot prove who changed money state; lock evidence incomplete |
| Safe to defer? | **No** for minimum audit fields on P1 transitions |
| Deferral rationale | N/A for minimum contract; full historical backfill of old events may defer |
| Timing | `P1_BLOCKING` (minimum fields on new P1 transitions) |
| Owner | Money-loop + Platform |
| Completion test | 100% of required P1 money-state transitions emit events with fields in Money-State Design Contract |

## KI-13 — Mobile / poor-connectivity behavior

| Field | Value |
| --- | --- |
| Evidence | Absent from ML-P1 planning PR #64; field-service norm |
| Affected workflow | Mobile estimate/job/invoice actions |
| Risk | Silent data loss; duplicate submits; corrupted state |
| Safe to defer? | **Full offline sync: yes.** **Safe retry / no silent loss: no.** |
| Deferral rationale | Full offline product is out of P1; double-tap and retry safety is blocking |
| Timing | `P1_BLOCKING` (idempotent retry) / `DEFER_SIGNED` (offline sync engine) |
| Owner | Mobile / UX owner |
| Completion test | Repeated-click and forced-retry tests: 0 duplicate jobs/invoices; user sees success/failure; no silent drop |

## KI-14 — Notes / text / paper escape

| Field | Value |
| --- | --- |
| Evidence | Independent ML-P1 planning-quality review; not measured in PR #64 |
| Affected workflow | Entire field path |
| Risk | System unused; data incomplete; dual books |
| Safe to defer? | **No** as acceptance criterion |
| Deferral rationale | N/A — P1 mobile path must be easier than Notes for core actions |
| Timing | `P1_BLOCKING` (acceptance observation) |
| Owner | Founder + field lead (observation); UX owner (fixes) |
| Completion test | Founder and technician complete P1 mobile path without Notes/text/paper/admin rescue |

## KI-15 — Manual re-entry points

| Field | Value |
| --- | --- |
| Evidence | Pillar 1 gaps; dual systems; weak follow-up |
| Affected workflow | Estimate→job→invoice handoffs |
| Risk | Cycle-time waste; transcription errors; lineage breaks |
| Safe to defer? | **No** on canonical P1 path; peripheral CRM pages yes |
| Deferral rationale | P1 path must not require retyping line items/prices across quote→job→invoice |
| Timing | `P1_MUST_DESIGN` / `P1_FIX_DURING` |
| Owner | Money-loop owner |
| Completion test | P1 test run: line items/prices flow by ID/lineage without re-key; checklist of re-entry points = 0 on path |

## KI-16 — Duplicate `JobCreated` (UAT-006 residual / B-007)

| Field | Value |
| --- | --- |
| Evidence | `uat-defect-log.md` UAT-006; backlog B-007 |
| Affected workflow | Quote accept → job; event metrics |
| Risk | Duplicate jobs or duplicate events; KPI inflation |
| Safe to defer? | **No** if causes duplicate jobs; event-only dup may be `P1_FIX_DURING` with metric caveat |
| Deferral rationale | Duplicate **jobs** block gates; duplicate **events** alone may ship only with metric exclusion + fix ticket |
| Timing | `P1_BLOCKING` (duplicate jobs) / `P1_FIX_DURING` (event hygiene) |
| Owner | Money-loop owner |
| Completion test | Double accept/retry: exactly one job; events explained or deduped |

## KI-17 — Windows node adapter exit anomaly (G2.3 hygiene)

| Field | Value |
| --- | --- |
| Evidence | G2.3 Exit Review; B3 runs HTTP 200 with process exit `-1073740791` |
| Affected workflow | Diagnostics adapter CLI only |
| Risk | False failure signals in scripts; not money-loop customer path |
| Safe to defer? | **Yes** |
| Deferral rationale | HTTP success proven; diagnostics hygiene; must not reopen G2.3 or block ML-P1 product gates |
| Timing | `HYGIENE` |
| Owner | Diagnostics |
| Completion test | Optional: adapter CLI exit 0 after success on Windows; not a money-loop ship gate |
