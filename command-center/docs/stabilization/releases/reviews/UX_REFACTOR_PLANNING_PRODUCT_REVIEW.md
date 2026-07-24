# UX-REFACTOR Planning — Product / IA Peer Review

| Field | Value |
| --- | --- |
| Lane | Independent PRODUCT / IA |
| Target | Planning docs only (Brief, Decision Packet, baton, ledgers) |
| PR | https://github.com/faydog127/BHFOS/pull/114 |
| Branch | `ml/ux-refactor-planning` |
| Exact HEAD | `344edc7af65bf07405bb4ca25a1f28783dba23c1` |
| Base | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Reviewed | 2026-07-23 |
| Verdict | **CHANGES REQUIRED** |

## Checks performed

| Focus | Result |
| --- | --- |
| Scope clarity (shell/nav/tokens/top-5 vs money/migrations/product pillars) | Partial — In/Out strong; Settings boundary underspecified |
| Top-5 screen choice | Acceptable set; mobile demotions need residual coverage |
| Nav IA vs Next-Phase §4 + live `BHFSidebar` / mobile bar | **Fail** — canonical primary list inconsistent across artifacts |
| PD-UX-01…06 defaults (A under auto-continue) | Mostly sound; blocked until nav PD reconciled |
| Parallel schedule + no-migration constraints | Pass — consistent across brief, baton, both ledgers, architecture |
| Escalation correctness vs Delegated-Authority Major Decisions | Pass — payment/schema/scope/dark-default covered; Hostinger matrix S noted |

Live CRM source of truth used for IA cross-check: `command-center/src/components/BHFSidebar.jsx`, `BHFCrmLayout.jsx` mobile bar, `App.jsx` routes (Hub/Jobs/Quotes/Inspections/Settings all exist).

## Blocking findings

### B1 — Primary desktop nav is not one binding list

Artifacts disagree on item count and labels:

| Artifact | Sequence |
| --- | --- |
| Next-Phase §4 | Dashboard → **CRM** → Jobs → Quotes → Inspections → **Analytics** → Settings |
| Brief §Target nav IA | Dashboard → **CRM/Hub** → Jobs → Quotes → Inspections → **Analytics/Reporting** → Settings |
| PD-UX-01 A | **Dashboard/Hub** → Jobs → Quotes → Inspections → **Reporting** → Settings |

Live app today: single Hub at `/:tenantId/crm` (dashboard aliases to `CRMHub`); Analytics label → `/crm/reporting`; Jobs route labeled **Work Orders**.

**Required fix:** One canonical primary list in Brief + PD-UX-01 (same labels, paths, and count). Explicitly decide:

1. One top item (**Hub**) vs two (**Dashboard** + **CRM**).
2. Canonical label for reporting surface: **Analytics** or **Reporting**, path `/crm/reporting` (or `/crm/analytics` if redirect already exists — document which).
3. Whether live **Work Orders** relabels to **Jobs** this slice (recommended: yes, to match Next-Phase / top-5).

### B2 — Settings top-5 vs Settings typed UI not bounded

Top-5 includes Settings, but Next-Phase #5 (typed billing/jobs/pricing UI) is a separate priority. Brief Out table blocks Stripe/auto-send/auto-charge but does not say Settings work is **chrome only** (header/breadcrumb/nav/tokens), not typed `settings.billing_*` / pricing forms.

**Required fix:** Add explicit Out row (or PD note): Settings chrome/IA only; typed Settings surface remains deferred Next-Phase #5; auto-charge/auto-send stay OFF / untouched.

### B3 — Residual register omits Invoices mobile demotion

PD-UX-02 A replaces live mobile primary **Hub · Leads · Quotes · Calendar · Invoices** with **Hub · Jobs · Quotes · Inspections · More**. R-UX-02 only accepts Leads/Calendar — not Invoices (currently a primary mobile destination).

**Required fix:** Extend R-UX-02 (or add R-UX-0x) to accept Invoices (and Leads/Calendar) as intentional mobile demotions under PD-UX-02 A, still reachable via More / desktop nav.

## Non-blocking notes

- **Parallel + no migrations:** Correctly pinned on baton (`schedule: parallel`, `db_migrations: forbidden`), both ML-P1 ledgers, brief, and halt defaults. Founder create override for running ahead of Photo Bundles/Analytics is recorded — escalation #8 satisfied by prior auth.
- **Top-5 set (Hub / Jobs / Quotes / Inspections / Settings):** Product-sensible high-traffic office set; Analytics correctly kept as nav reorder target only (not chrome consolidation). Routes/files exist under `command-center/src`.
- **PD-UX-03…05 A:** Token extend + `CrmPageHeader` + thin toolbar consolidation are right-sized; reject full DataTable / design-system extract.
- **PD-UX-06 A:** Deferring dark-mode toggle vs Next-Phase §4 bullet is an acceptable auto-continue default with R-UX-03; not blocking if B1–B3 fixed.
- **Escalation list:** Payment defaults, schema/RLS, scope expansion beyond top-5+shell, and dark-as-default correctly escalate. Success criteria correctly withhold Hostinger until Access Matrix **S** / Founder deploy auth.

## Verdict

**CHANGES REQUIRED** at `344edc7af65bf07405bb4ca25a1f28783dba23c1`.

Remediate B1–B3 in Brief + Decision Packet (+ residual/baton if labels change), then re-request PRODUCT / IA review. Do not treat PD-UX-01/02 as auto-continue-ready until the canonical nav list and Settings chrome boundary are identical across artifacts.
