# UX-REFACTOR Planning — Product / IA Peer Review

| Field | Value |
| --- | --- |
| Lane | Independent PRODUCT / IA |
| Target | Planning docs only (Brief, Decision Packet, baton, ledgers) |
| PR | https://github.com/faydog127/BHFOS/pull/114 |
| Branch | `ml/ux-refactor-planning` |
| Exact HEAD | `1f91fb50abd44016b0d16b8d24cfcb469d6b70b6` |
| Base | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Reviewed | 2026-07-23 |
| Prior review | CHANGES REQUIRED at `344edc7af65bf07405bb4ca25a1f28783dba23c1` |
| Verdict | **APPROVE** |

## Checks performed

| Focus | Result |
| --- | --- |
| Scope clarity (shell/nav/tokens/top-5 vs money/migrations/product pillars) | Pass — Settings chrome-only boundary explicit |
| Top-5 screen choice | Pass — Hub / Work Orders / Quotes / Inspections / Settings |
| Nav IA vs Next-Phase §4 + live `BHFSidebar` / mobile bar | Pass — one canonical primary list across Brief, PD-UX-01, baton |
| PD-UX-01…06 defaults (A under auto-continue) | Pass — ready for auto-continue |
| Parallel schedule + no-migration constraints | Pass — consistent across brief, baton, ledgers, architecture |
| Escalation correctness vs Delegated-Authority Major Decisions | Pass — payment/schema/scope/dark-default covered; Hostinger matrix S noted |

Live CRM source of truth used for IA cross-check: `command-center/src/components/BHFSidebar.jsx`, `BHFCrmLayout.jsx` mobile bar, `App.jsx` routes (Hub/Jobs/Quotes/Inspections/Settings all exist).

## Prior blockers — remediation check

### B1 — Primary desktop nav is not one binding list → **Cleared**

Canonical primary list is identical in Brief §Target nav IA, PD-UX-01 A, and baton `canonical_primary_nav`:

| Order | Label (UI) | Path |
| --- | --- | --- |
| 1 | Hub | `/crm` |
| 2 | Work Orders | `/crm/jobs` |
| 3 | Quotes | `/crm/quotes` |
| 4 | Inspections | `/crm/inspections` |
| 5 | Analytics | `/crm/reporting` |
| 6 | Settings | `/crm/settings` |

Explicit decisions recorded:

1. **One** top item (**Hub**), not Dashboard + CRM.  
2. Label **Analytics**, path `/crm/reporting` (matches live `BHFSidebar`).  
3. Keep live **Work Orders** label (docs may say “Jobs screen”); no synonym drift in UI copy.

Next-Phase §4 synonym wording (Dashboard/CRM/Jobs/Reporting) is intent-only; binding artifacts use live labels/paths per PD-UX-01 Q framing.

### B2 — Settings top-5 vs Settings typed UI not bounded → **Cleared**

Brief **Settings boundary** + baton `settings … (chrome only)` + architecture findings: top-5 Settings = chrome/tokens/layout only; typed `settings.billing_*` / pricing UI stays Next-Phase #5; auto-send/auto-charge stay OFF / untouched. Out table still blocks Stripe / auto-send / auto-charge.

### B3 — Residual register omits Invoices mobile demotion → **Cleared**

PD-UX-02 A = **Hub · Work Orders · Quotes · Inspections · More**, with note that demoting Invoices/Leads/Calendar is intentional. Residuals: R-UX-02 (Leads/Calendar Accepted), R-UX-07 (Invoices demoted — Accepted); still reachable via sidebar + More.

## Non-blocking notes

- **Parallel + no migrations:** Correctly pinned on baton (`schedule: parallel`, `db_migrations: forbidden`), both ML-P1 ledgers, brief, and halt defaults. Founder create override for running ahead of Photo Bundles/Analytics is recorded — escalation #8 satisfied by prior auth.
- **Top-5 set:** Product-sensible high-traffic office set; Analytics correctly kept as nav reorder target only (not chrome consolidation). Routes/files exist under `command-center/src`.
- **PD-UX-03…05 A:** Token extend + `CrmPageHeader` + thin toolbar consolidation are right-sized; reject full DataTable / design-system extract.
- **PD-UX-06 A:** Deferring dark-mode toggle vs Next-Phase §4 bullet is an acceptable auto-continue default with R-UX-03.
- **Escalation list:** Payment defaults, schema/RLS, scope expansion beyond top-5+shell, and dark-as-default correctly escalate. Success criteria correctly withhold Hostinger until Access Matrix **S** / Founder deploy auth.

## Verdict

**APPROVE** at `1f91fb50abd44016b0d16b8d24cfcb469d6b70b6`.

Prior PRODUCT blockers B1–B3 are remediated. PD-UX-01/02 A are auto-continue-ready for planning merge once remaining peer lanes + CI agree.
