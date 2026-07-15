# V1 Stabilization Release Plan

**Principle:** One operational theme · one branch · one clean worktree · one PR · one deploy report.  
**Base:** always `origin/main` after prior release closes.  
**Dirty tree `F:\Dev\BHFOS`:** never.

Priority order (unless new P0 outage):

1. Data integrity / identity  
2. Lead/customer/property intake  
3. Scheduling / job creation  
4. Estimate → job  
5. Invoice / payment consistency  
6. Inspection follow-up defects  
7. Mobile UX simplification  
8. Repo / release hygiene  
9. Visual polish (optional)

---

## Release R1 — Identity & relationship safety

| Field | Value |
| --- | --- |
| Goal | Eliminate remaining broken PostgREST property embeds; document technician id contract; decide Accept vs design spike for CRM property SoT |
| Includes | B-001 (embed ban / accept fallback), B-002, B-011, B-014 |
| Excludes | Property table redesign migration; marketing properties rewrite |
| Likely files | `paymentService.js`, `ProposalBuilder.jsx`, any CRM selects with `property:property_id`, docs |
| Migration risk | **None preferred.** Schema redesign requires explicit approval → else defer structural work |
| Acceptance | Grep-clean critical paths; payment/invoice screens load; UUID property_id inspections still open |
| Production verification | Synthetic invoice view + tech inspection open |
| Stop conditions | Any migration proposed without approval; scope expands to redesign |

**Branch:** `stabilize/r1-identity-relationship-safety`  
**Worktree:** `F:\Dev\BHFOS-stabilize-r1` (example)

---

## Release R2 — Intake clarity

| Field | Value |
| --- | --- |
| Goal | Reliable lead/customer creation with clear required fields and loud failures |
| Includes | B-006, B-015, optionally B-018 |
| Excludes | New CRM modules; property architecture |
| Likely files | `Leads.jsx`, `appointmentService.js`, `InspectionFieldCustomerStep.jsx` |
| Migration risk | Low; avoid |
| Acceptance | Create lead from CRM + field with address; missing required field blocked with plain language |
| Production verification | Synthetic lead create/delete |
| Stop conditions | Touches billing or quote triggers |

---

## Release R3 — Scheduling for operations (incl. phone)

| Field | Value |
| --- | --- |
| Goal | Tech can see/navigate schedule from phone; reduce appointment/job dual-edit confusion |
| Includes | B-005, B-016 |
| Excludes | New dispatch AI; route optimization |
| Likely files | `TechRoutes.jsx`, `TechSchedule.jsx` or queue enhancements, AppointmentScheduler |
| Migration risk | None |
| Acceptance | Tech opens schedule/queue spanning days; linked job times match appointment |
| Production verification | Synthetic appointment + tech login |
| Stop conditions | Rewrites work order board |

---

## Release R4 — Estimate → job reliability

| Field | Value |
| --- | --- |
| Goal | One path from sold work to job |
| Includes | B-004, B-007 |
| Excludes | New pricing engine |
| Likely files | `EstimateEditorModal.jsx`, `quoteService.js`, ProposalList, event writers |
| Migration risk | Low; trigger changes need explicit approval |
| Acceptance | Accept quote → exactly one job; legacy estimate path disabled or forced bridge |
| Production verification | Synthetic quote accept (no customer send) |
| Stop conditions | Changing invoice auto-create defaults without approval |

---

## Release R5 — Invoice & payment state consistency

| Field | Value |
| --- | --- |
| Goal | Single operational paid/invoiced truth in UI |
| Includes | B-008 (+ residual from B-002 if not done) |
| Excludes | New payment providers; QuickBooks expansion |
| Likely files | Work order board projections, invoice UI, paymentService |
| Migration risk | Avoid; prefer read-path alignment |
| Acceptance | Invoice paid ⇒ ops stage paid; no conflicting badges |
| Production verification | Synthetic invoice status change (no live charge) |
| Stop conditions | Webhook secret changes; live Stripe config edits |

---

## Release R6 — Inspection follow-up & report defects

| Field | Value |
| --- | --- |
| Goal | Defect-driven report/follow-up correctness |
| Includes | B-012, B-019 |
| Excludes | Report visual redesign |
| Likely files | PDF function only if proven; report UI; crm_tasks creation points |
| Migration risk | None unless approved |
| Acceptance | PDF contract tests green; follow-up task visible after defined trigger |
| Production verification | Synthetic inspection report generate (no customer send) |
| Stop conditions | Redeploying PDF without diff proof |

---

## Release R7 — Mobile UX simplification

| Field | Value |
| --- | --- |
| Goal | Reduce typing, technical errors, CRM side trips from field feedback |
| Includes | B-013 (+ small P2 friction items proven in field) |
| Excludes | New field modules |
| Likely files | Tech inspection components only |
| Migration risk | None |
| Acceptance | Founder field checklist pass |
| Production verification | Device acceptance on app.bhfos.com |
| Stop conditions | “While we’re here” CRM refactors |

---

## Release R8 — Release hygiene

| Field | Value |
| --- | --- |
| Goal | Repeatable deploy + migration immutability + tmp artifact policy |
| Includes | B-009, B-010, B-017, optionally B-020 |
| Excludes | Feature work |
| Likely files | `tools/deploy-*.mjs`, CI workflow, governance docs |
| Migration risk | None (policy/CI only) |
| Acceptance | Dry-run deploy package from clean worktree; CI blocks historical migration edits |
| Production verification | Optional no-op deploy dry-run only |
| Stop conditions | Actual prod deploy bundled with unrelated app changes |

---

## Release R9 — Visual polish (optional)

| Field | Value |
| --- | --- |
| Goal | Only if operational branding issues block customer trust |
| Includes | B-021 if promoted |
| Disposition default | **Defer to V2** |
| Stop conditions | Any polish PR that touches money/schema |

---

## Cross-release rules

1. Human approval before merge and before deploy.  
2. No production access during implementation.  
3. No remote migrations without written approval in the release PR.  
4. Production acceptance required before closing a release.  
5. Update backlog dispositions after each release.  
6. If a P0 outage appears, preempt the queue with a hotfix release (same hygiene rules).
