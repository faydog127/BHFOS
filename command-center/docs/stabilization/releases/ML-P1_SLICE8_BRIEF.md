# ML-P1 Slice 8 — Brief (A0/A1 planning only)

| Field | Value |
| --- | --- |
| Slice | **ML-P1-S8** Mobile Inspections, Photo Bundles & UX Polish |
| Planning base | `3cd9a32a03c07eda541daf75e28ddb0ec4aa27e2` (`origin/main`) |
| Stale SHA in Founder paste | `e9cc3317…` — **superseded** (S6 closed at tip above) |
| Branch | `ml/p1-s8-planning` |
| Prior slices | S1–S6 **CLOSED** · S7 **deferred** (autonomous follow-up / warranty) |
| Product decisions | **PD-S8-01…07 DRAFT** → Founder Category-C before any A2 coding |
| Coding / migrate / deploy | **Blocked** until Founder Category-C on PD answers |

## One-sentence goal

Give technicians a reliable offline-capable mobile inspection workflow with structured checklists and required photos, give office a path to customer-ready photo bundles (PDF, no Stripe attach), and tighten analytics + global IA — without merging TIS, rewriting multi-tenant, or bypassing S4 job-completion readiness.

## Scope pillars (this planning packet)

| # | Pillar | Intent |
| --- | --- | --- |
| 1 | Technician Mobile Inspections | Job-type checklist · required photo capture/annotation · offline queue · safety/quality flags in office UI |
| 2 | Photo Bundles | Select shots → customer-ready bundle PDF for proposals/invoices (**no** Stripe attach) |
| 3 | Analytics Dashboard Enhancements | Job pipeline KPIs · quote→invoice funnel · CO uptake (read-only) |
| 4 | Global UX/IA Cleanup | Nav order · settings discoverability · mobile layout quirks |

## In / out

| In | Out (this slice) |
| --- | --- |
| Evolve existing `inspections` / `inspection_photos` / field stepper | TIS product merge / shared multi-tenant redesign |
| Offline media queue hardening + optional draft sync (`inspection-sync` if ratified) | Silent job completion without S4 readiness |
| Structured checklist per job type (model TBD in PD-S8-03) | Auto-send / auto-charge / vault / Terminal |
| Photo bundle album + PDF generation for quote/invoice attach (non-Stripe) | Billing from analytics / write RPCs / customer analytics portal |
| Read-only `ml_analytics_*` (or equivalent) KPIs + Reporting IA | Nightly full regression suite (post-S8 thin track) |
| Nav / breadcrumbs / mobile shell polish | Destructive schema / historical money rewrite |

## Live baseline (planning facts)

- CRM routes already exist: `/crm/inspections/*` + tech `/tech/inspections/*` (feature-flagged).
- Schema: `inspections`, `inspection_findings`, `inspection_recommendations`, `inspection_photos`, reports/AI/delivery tables — **no** `inspection_items` table yet.
- Offline today: **photo IDB queue only** (`offlineInspectionMediaQueue.js`); no full draft sync Edge.
- Edges: `inspection-report-pdf`, `inspection-report-send`, `inspection-ai-analyze` — **no** `inspection-sync`.
- Analytics today: client-side `Reporting` / `AnalyticsDashboard` — **no** `ml_analytics_*` RPCs; `/crm/analytics` route not registered.
- Photo bundles / drag-reorder albums: **not implemented**.
- Nav (`BHFSidebar`) differs from Next-Phase target order.

## Success criteria (when coding later authorized)

1. Tech can complete a job-type checklist inspection with required photos offline and sync without data loss.  
2. Office sees safety/quality flags from field inspections without CRM side-trips.  
3. Office can select photos → generate a customer-ready bundle PDF usable from proposal/invoice flows (no Stripe attachment).  
4. Analytics surfaces pipeline / funnel / CO uptake via read-only metrics (no write RPCs).  
5. Global nav/IA matches ratified target; mobile quirks in scope are closed with evidence.  
6. Synthetic-only prod validation; no real-customer mutation in synth; S4 completion gates remain authoritative for jobs.

## Escalation triggers (Founder Major Decision)

- Enabling invoice **auto-send** / **auto-charge** for real customers  
- TIS merge, shared multi-tenant redesign, or PCI/payment-rail changes  
- Silent job completion or bypass of S4 readiness  
- Destructive retention deletes of customer photos without explicit policy  
- Expanding Slice 8 into S7 warranty/dispatch automation

## Related artifacts

- Decisions: `docs/governance/decisions/ML-P1_SLICE8_FOUNDER_DECISIONS_PD_S8_01_07.md`  
- Architecture: `docs/architecture/ML-P1_SLICE8_ARCHITECTURE_FINDINGS.md`  
- State: `docs/governance/state/ML-P1_STATE_LEDGER.md` (+ stabilization ledger sync)  
- Priorities: `docs/governance/ML-P1_NEXT_PHASE_PRIORITIES.md`  
- Evidence: `docs/stabilization/releases/ML-P1_SLICE8_EVIDENCE_MANIFEST.md`
