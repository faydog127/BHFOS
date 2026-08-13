# V1 Stabilization Backlog

**Cap:** 25 verified issues (this package).  
**Filter:** Only items that threaten V1 stability, security, usability, or operations.  
**Source tip:** `209823b`

Disposition meanings:

- **Fix in V1** — required for freeze success  
- **Accept in V1** — known debt with controlled workaround  
- **Defer to V2** — valuable later; not required for daily ops

---

## P0 — Security / tenant / data loss / outage / financial corruption

### B-001 — Lead↔property identity break (UUID vs bigint)

| Field | Value |
| --- | --- |
| Severity | P0 (data integrity) / residual outage risk if embeds return |
| User impact | Inspections failed open after PR #36; property joins still unsafe |
| Workflow | Lead → Property → Inspection |
| Reproduction | Select `lead:leads(..., property:property_id(...))` or query `properties` with UUID id |
| Evidence | Hotfix smoke; `inspectionFieldAddress.js`; migration comment in `20260512180000_…` |
| Likely root cause | Hosted `properties` is scouting/marketing table; CRM pointer is uuid |
| Affected | `leads`, `properties`, inspection field helpers, `paymentService` embeds |
| Smallest fix | (Near-term) ban embeds + resilient hydrate (**done #37/#38**). (Structural) define CRM property SoT without rewriting marketing table |
| Test | `inspection-field-address-schema.spec.js` + prod smoke with UUID `property_id` |
| Production risk | High if any path reintroduces embeds |
| Recommended release | R1 (integrity) for structural decision; accept fallback until then |
| Disposition | **Accept in V1** (opaque `property_id` + address fallbacks) — embed ban **done** (R1A) + guarded (R1C) |

### B-002 — Payment / invoice property embed still assumes broken FK

| Field | Value |
| --- | --- |
| Severity | P0/P1 (payment UX / possible load failure) |
| User impact | Invoice/pay views may fail or miss address |
| Workflow | Invoice → Payment |
| Reproduction | Open payment paths that call `paymentService` lead/invoice selects with `properties!fk_leads_property(address1…)` |
| Evidence | `src/services/paymentService.js` L27–28, L56 |
| Likely root cause | Same property schema drift |
| Affected | `paymentService.js`, public pay/invoice |
| Smallest fix | Remove embed; use lead address / invoice denormalized fields |
| Test | Focused paymentService select contract test + public pay smoke |
| Production risk | Medium–high on address-dependent payment screens |
| Recommended release | R1 |
| Disposition | **Fixed in V1** (R1A removed embeds; R1C guards recurrence) |

### B-003 — Tenant isolation / money-writer regressions (watch)

| Field | Value |
| --- | --- |
| Severity | P0 |
| User impact | Cross-tenant data exposure or wrong-tenant money writes |
| Workflow | All money loop |
| Reproduction | UNKNOWN exact open exploit; tracked as watch item |
| Evidence | `docs/handoff/handshake_next_chat.md` P0-01; `20260419110000_h1b_tenant_id_immutability_v1.sql` |
| Likely root cause | Historical non-canonical writers |
| Affected | RLS, edge functions, money services |
| Smallest fix | Keep immutability + audit non-canonical writers only when proven |
| Test | Existing tenant trust / ledger gates |
| Production risk | Existential if regressed |
| Recommended release | Continuous gate; dedicated R0 if new leak proven |
| Disposition | **Accept in V1** as controlled watch unless new leak proven — then **Fix in V1** immediately |

---

## P1 — Blocks field / intake / schedule / report / money flow

### B-004 — Dual estimate systems (`estimates` vs `quotes`)

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Confusing “Estimates” UI; risk of orphan estimates not becoming jobs |
| Workflow | Estimate → Job |
| Evidence | `EstimateEditorModal` inserts `estimates`; ProposalBuilder uses `quotes`; no CREATE migration for `estimates` |
| Root cause | Legacy + canonical paths coexist |
| Smallest fix | Freeze writes: new work only to `quotes`; hide/disable legacy modal or bridge-only |
| Test | Quote-accept → job integration smoke |
| Release | R4 |
| Disposition | **Fix in V1** |

### B-005 — Tech phone scheduling incomplete

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Tech cannot manage calendar from phone; depends on office dispatch |
| Workflow | Schedule |
| Evidence | `TechSchedule.jsx` exists; not in `TechRoutes.jsx`; tech sees today’s jobs on queue only |
| Smallest fix | Mount read-only tech schedule **or** improve queue date navigation — no CRM rewrite |
| Test | Mobile tech route smoke |
| Release | R3 |
| Disposition | **Fixed in V1** (`/tech/schedule` mounted; multi-day read-only schedule). Production verified after PR #44. |

### B-006 — Lead / customer / property intake ambiguity

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Techs/office create incomplete customers; address ends up in multiple places |
| Workflow | Lead → Customer → Property |
| Evidence | Field step writes `leads.address` + `property_formatted_address`; contacts optional; property link broken |
| Smallest fix | Document + enforce single intake checklist: required phone/name/address fields; stop inventing property rows |
| Test | Field customer step + CRM lead create smoke |
| Release | R2 |
| Disposition | **Fixed in V1** (`leadIntakeContract.js`; CRM / field / scheduler / `createCustomer`) |

### B-007 — Quote-accept → job reliability / duplicate events

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Job missing or duplicate JobCreated noise; office confusion |
| Workflow | Estimate → Job |
| Evidence | UAT note duplicate `JobCreated` (2026-03-13 pass); trigger `ensure_job_and_optional_draft_invoice_for_accepted_quote` |
| Smallest fix | Verify idempotency; suppress duplicate events; monitor failed accepts |
| Test | Accept quote twice → one job |
| Release | R4 |
| Disposition | **Fix in V1** |

### B-008 — Invoice vs job payment status divergence

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Board shows wrong paid/invoiced state |
| Workflow | Invoice → Payment |
| Evidence | `job_operational_state_v1` invoice authority; job `payment_status` still written elsewhere |
| Smallest fix | UI reads ops projection only; stop writing competing job payment stage in app paths |
| Test | Invoice paid → ops stage paid |
| Release | R5 |
| Disposition | **Fix in V1** |

### B-009 — Deploy tooling not on main (release non-repeatability)

| Field | Value |
| --- | --- |
| Severity | P1 (ops) |
| User impact | Emergency deploys improvise; wrong env risk |
| Workflow | Release |
| Evidence | `deploy-lib.mjs` / `deploy-hostinger-static.mjs` absent from `origin/main` |
| Smallest fix | Commit a minimal, reviewed Hostinger deploy tool under `tools/` with dry-run |
| Test | Dry-run packaging test (no prod upload in CI) |
| Release | R8 |
| Disposition | **Fix in V1** |

### B-010 — Migration history / immutability enforcement gaps

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Accidental migration rewrite or unapproved prod migrate |
| Workflow | Release |
| Evidence | History restored `2f5d244`; no formal “never edit applied SQL” doc; Ledger Lock exists |
| Smallest fix | Written policy + CI path check forbidding edits to already-applied migration files |
| Test | CI negative test on edited historical migration |
| Release | R8 |
| Disposition | **Fix in V1** |

### B-011 — Remaining CRM PostgREST property relationship assumptions

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Office screens fail similarly to tech inspection outage |
| Workflow | Lead/Property/Invoice |
| Evidence | `ProposalBuilder.jsx` still has `property:property_id(...)` fallbacks; paymentService embeds |
| Smallest fix | Grep-ban embed pattern in money/CRM paths; replace with safe selects |
| Test | Source contract test (no `property:property_id(` in critical services) |
| Release | R1 |
| Disposition | **Fix in V1** |

### B-012 — Inspection report / PDF correctness residual risk

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Wrong customer-facing report content |
| Workflow | Inspection → Follow-up |
| Evidence | PDF at v8; content-contract handoff marked packaging-ready historically; field UX still new |
| Smallest fix | Defect-driven only; no redesign. Keep Phase E contract tests green |
| Test | `phase-e-customer-report-pdf.spec.js` |
| Release | R6 |
| Disposition | **Fix in V1** (defect-driven) |

### B-013 — Mobile field workflow friction (typing / errors / side trips)

| Field | Value |
| --- | --- |
| Severity | P1 |
| User impact | Slow jobs; tech avoids app |
| Workflow | Inspection |
| Evidence | Field UX v2 shipped; founder Ferret acceptance **UNKNOWN** in this package |
| Smallest fix | Punch-list from real-device feedback only |
| Test | Field UX smoke + device checklist |
| Release | R7 |
| Disposition | **Fix in V1** after field feedback |

---

## P2 — Repeated workarounds / friction / inconsistent data

### B-014 — Technician identity documentation / test drift

| Field | Value |
| --- | --- |
| Severity | P2 |
| User impact | Mis-assignment bugs during changes |
| Evidence | Superseded `unify_technician_id_on_user_id` vs phase1.5 FK to `technicians.id` |
| Smallest fix | Docs + fix drifting tests/fixtures |
| Release | R1 |
| Disposition | **Fixed in V1** (R1B roster-id writes; R1C guards + helper contracts) |

### B-015 — Customer intake workarounds (column fallback inserts)

| Field | Value |
| --- | --- |
| Severity | P2 |
| User impact | Silent field drops on create |
| Evidence | `Leads.jsx` / `appointmentService` retry without missing columns |
| Smallest fix | Explicit required-column contract; fail loud in UI |
| Release | R2 |
| Disposition | **Fixed in V1** (create paths fail loud via `describeLeadIntakeDbError`; no silent strip) |

### B-016 — Appointment ↔ job schedule dual write confusion

| Field | Value |
| --- | --- |
| Severity | P2 |
| User impact | Time shown differs between calendar and work order |
| Evidence | Packet 008 sync trigger; both surfaces editable historically |
| Smallest fix | UI: edit appointments only; jobs schedule read-only when linked |
| Release | R3 |
| Disposition | **Frontend fixed in V1** (Jobs + Dispatch lock when `appointments.job_id` set; PR #44). **Production activation blocked** by enum-unsafe appointment triggers (`coalesce(status, '')` vs `appointment_status`) — repaired by R3B migration `20260716003000_fix_appointment_trigger_enum_safety.sql`. No automatic linking. Production B-016 re-smoke still required after migration deploy. |

### B-017 — Tracked `tmp/` tenant / ledger artifacts noise

| Field | Value |
| --- | --- |
| Severity | P2 |
| User impact | Review gate warnings; repo clutter |
| Evidence | Ledger Lock warnings on artifact mtimes; committed `tmp/billing-ledger-php`, `tmp/orchestrator-v2` |
| Smallest fix | Quarantine policy: what may be committed under `tmp/` |
| Release | R8 |
| Disposition | **Fix in V1** (hygiene) |

### B-018 — Contacts not in primary sidebar

| Field | Value |
| --- | --- |
| Severity | P2 |
| User impact | Office hard to find contacts |
| Evidence | Routed but absent from `BHFSidebar` |
| Smallest fix | Add nav item **or** merge into Leads UX — choose one |
| Release | R2 |
| Disposition | **Accepted in V1** (deferred; not required for intake clarity) |

### B-019 — Follow-up task surface weak

| Field | Value |
| --- | --- |
| Severity | P2 |
| User impact | Missed callbacks |
| Evidence | `crm_tasks` + Flow Console; empty-state if unavailable |
| Smallest fix | Ensure post-inspection / post-invoice follow-up creates visible task |
| Release | R6 |
| Disposition | **Fix in V1** (minimal) |

### B-020 — Feature-flag dual systems (React context vs bhf.config)

| Field | Value |
| --- | --- |
| Severity | P2 |
| User impact | Unexpected module visibility |
| Evidence | `FeatureFlagContext` vs `featureFlags.js` / `bhf.config.json` gaps for inspections/tech |
| Smallest fix | Document resolution order; align missing defaults |
| Release | R8 |
| Disposition | **Accept in V1** unless a flag blocks ops |

---

## P3 — Cosmetic / polish

### B-021 — Visual polish / branding polish on reports

| Field | Value |
| --- | --- |
| Severity | P3 |
| Disposition | **Defer to V2** (or late R9 if operationally needed) |
| Note | Content correctness > cosmetics |

### B-022 — Orphan TechDashboard page

| Field | Value |
| --- | --- |
| Severity | P3 |
| Disposition | **Accept in V1** (do not delete in drive-by cleanup) |

---

## V2 — Explicitly deferred

### B-023 — Full CRM property model redesign / multi-tenant property architecture

Disposition: **Defer to V2**

### B-024 — Major analytics platform / speculative automation

Disposition: **Defer to V2**

### B-025 — Broad CRM expansion / new modules

Disposition: **Defer to V2**

---

## Seed coverage checklist

| Seed topic | Backlog IDs |
| --- | --- |
| leads.property_id vs properties.id | B-001, B-011 |
| Technician identity | B-014 |
| Lead/customer/property lifecycle | B-006, B-015, B-018 |
| Scheduling from phone | B-005, B-016 |
| Customer intake workarounds | B-006, B-015 |
| Quote-to-job | B-004, B-007 |
| Invoice authority/status | B-008 |
| Migration immutability | B-010 |
| tmp/tenant artifacts | B-017 |
| Release/deploy repeatability | B-009 |
| PDF/report defects | B-012 |
| Mobile field friction | B-013 |

---

## Counts

| Severity | Count |
| --- | --- |
| P0 | 3 |
| P1 | 10 |
| P2 | 7 |
| P3 | 2 |
| V2 | 3 |
| **Total** | **25** |
