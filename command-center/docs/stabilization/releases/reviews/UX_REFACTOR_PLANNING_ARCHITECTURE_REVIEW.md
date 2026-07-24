# UX-REFACTOR Planning — Architecture Peer Review (re-review)

| Field | Value |
| --- | --- |
| Role | Independent Architecture (peer) |
| Slice | UX-REFACTOR (A0/A1 planning) |
| Branch | `ml/ux-refactor-planning` |
| Exact HEAD | `1f91fb50abd44016b0d16b8d24cfcb469d6b70b6` |
| Planning base (claimed) | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Prior review HEAD | `344edc7af65bf07405bb4ca25a1f28783dba23c1` (**CHANGES REQUIRED**) |
| Reviewed | `UX_REFACTOR_ARCHITECTURE_FINDINGS.md`, `UX_REFACTOR_BRIEF.md`, `UX_REFACTOR_DECISION_PACKET.md` (+ baton / residuals / evidence for consistency) |
| Live source checked | `command-center/src` on this HEAD |
| Verdict | **APPROVE** |

## Scope of this review

Re-check after remediation of A-UX-01…03: feasibility of shell / nav / token approach; integrity of the no-migration constraint; consolidation depth (PD-UX-05); material architecture risks before A2.

## Verdict summary

Prior blockers are cleared. Ownership is pinned to `command-center/src/`, primary IA is bound (Hub / Work Orders / Analytics labels + paths), and the `EnterpriseLayout` as-is claim is accurate (nested residual, not “unmounted”). Planning packet is accurate enough to authorize Architecture sign-off for A2 coding under the remaining peer + CI gates.

---

## Prior blockers — disposition

### A-UX-01 — Ownership paths omit `command-center/` — **CLEARED**

**Evidence at this HEAD:**

- Findings code root: `command-center/src/` only; as-is / to-be paths fully prefixed.
- Brief top-5 table + explicit “not repo-root `src/`” rule.
- Baton `code_root: "command-center/src"`.
- Constraint: do not edit repo-root `src/` in this slice.

Wrong-tree risk is mitigated for A2 allowlisting.

### A-UX-02 — Primary nav IA under-specified — **CLEARED**

Canonical primary IA is identical across Brief, Findings, PD-UX-01, and baton:

1. Hub → `/crm`  
2. Work Orders → `/crm/jobs`  
3. Quotes → `/crm/quotes`  
4. Inspections → `/crm/inspections`  
5. Analytics → `/crm/reporting`  
6. Settings → `/crm/settings`  

**Bind answers:**

| Question | Binding |
| --- | --- |
| Hub vs Dashboard | One primary entry **Hub** at `/crm`; naming rule prefers Hub over Dashboard (live `dashboard` route remains CRMHub alias — SOURCE `App.jsx`) |
| Jobs vs Work Orders | Display label **Work Orders** at `/crm/jobs` (matches live `BHFSidebar`) |
| Analytics | Label **Analytics**, path `/crm/reporting` (label-only; no route rename) |
| Secondary below divider | Leads, Call Console, SMS Inbox, Opportunities, Calendar, Dispatch, Invoices, Marketing, Partners, Ops Dashboard |

A2 nav reorder will not invent product naming.

### A-UX-03 — Legacy shell claim false — **CLEARED**

Findings now state nested legacy chrome (`EnterpriseLayout` on Contacts / SettingsPage / ReportsPage variants); in-scope only to stop nesting on top-5 paths; do not claim globally unmounted. Residual R-UX-06 tracks Contacts double-chrome.

**SOURCE check this HEAD:** Top-5 primaries (`CRMHub`, `Jobs`, `ProposalList`, `Inspections`, `Settings`) do not import `EnterpriseLayout`. `ContactsPage` (and other non-top-5 pages) still nest it under `BHFCrmLayout` — consistent with the corrected claim.

---

## Findings (non-blocking / track into A2)

### A-UX-04 — Shell/nav/token approach remains feasible

- Mobile bottom bar already exists inline in `BHFCrmLayout`; PD-UX-02 A is a list swap + More overflow.
- PD-UX-03 A (shadcn HSL aliases) is sound; success criteria still require shell + top 5 brand surfaces to consume aliases (not aliases-only definition).
- PD-UX-06 A (no dark toggle) correctly bounds scope.

### A-UX-05 — Consolidation depth PD-UX-05 A

Approve. Shared `CrmPageHeader` + thin `CrmListToolbar`; forbid generic DataTable rewrite that would touch Jobs money columns/handlers.

**Coding guard:** A2 touches on Jobs / Quotes list / Settings = chrome wrappers only; no payment, delete, status, billing-flag, or inspection completion handler edits.

### A-UX-06 — No-migration constraint

Intact: Brief, PD, baton (`db_migrations: forbidden`), Findings, Evidence. Floating +Create = navigate to existing create routes only.

S8 Inspections overlap tracked as R-UX-08 (list/shell chrome only).

### A-UX-07 — Risk register

Findings + residuals cover wrong-tree, EnterpriseLayout double-chrome, token contrast, scope creep, S8 boundary. Adequate for planning APPROVE.

---

## What remains good

- One-sentence goal and in/out table keep Photo Bundles, S7, Stripe auto-send/charge, TIS, migrations out.
- Top-5 route → file mapping matches live `App.jsx` lazy imports.
- Evidence manifest correctly non-claims production UI / Hostinger from planning alone.
- Risk tier Tier 2 + frontend-only posture is appropriate if money/inspection gates stay untouched.

---

## Disposition

| Item | Status |
| --- | --- |
| Verdict | **APPROVE** |
| Exact HEAD reviewed | `1f91fb50abd44016b0d16b8d24cfcb469d6b70b6` |
| Prior blockers A-UX-01…03 | Cleared |
| Blocking findings remaining | None |

**Authorized next state:** Architecture planning lane APPROVED at this SHA. A2 coding remains gated on Product + Security peer APPROVE + CI per baton (not granted by this review alone).
