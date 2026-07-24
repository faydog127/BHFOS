# UX-REFACTOR Planning — Architecture Peer Review

| Field | Value |
| --- | --- |
| Role | Independent Architecture (peer) |
| Slice | UX-REFACTOR (A0/A1 planning) |
| Branch | `ml/ux-refactor-planning` |
| Exact HEAD | `344edc7af65bf07405bb4ca25a1f28783dba23c1` |
| Planning base (claimed) | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Reviewed | `UX_REFACTOR_ARCHITECTURE_FINDINGS.md`, `UX_REFACTOR_BRIEF.md`, `UX_REFACTOR_DECISION_PACKET.md` (+ baton / residuals / evidence for consistency) |
| Live source checked | `command-center/src` on this HEAD |
| Verdict | **CHANGES REQUIRED** |

## Scope of this review

Feasibility of shell / nav / token approach; integrity of the no-migration constraint; consolidation depth (PD-UX-05); material architecture risks before A2.

## Verdict summary

Direction is sound (reuse `BHFCrmLayout` + `BHFSidebar` + shadcn tokens; PD-UX-05 A over a generic DataTable rewrite; migrations forbidden). Planning packet is **not yet accurate enough to authorize A2** because ownership paths are ambiguous, primary IA is under-specified, and the live legacy-shell claim is false.

---

## Findings (blocking)

### A-UX-01 — Ownership paths omit `command-center/` (wrong-tree risk)

**Severity:** Blocking  
**Evidence:** Findings / Brief / PD list targets as bare `src/components/BHFCrmLayout.jsx`, `src/components/BHFSidebar.jsx`, `src/pages/crm/*`. This repo also has a divergent root `src/components/BHFCrmLayout.jsx` (no mobile bottom bar; hardcoded `/bhf/crm/*` paths) and archive trees with same filenames.

**Required fix:** Pin every ownership / to-be path to `command-center/src/...`. Explicitly mark root `src/`, `Horizon/`, `Website/`, `legacy-crms/`, and archives as **non-targets**. A2 file allowlist should start from that pin.

### A-UX-02 — Primary nav IA under-specified (Dashboard vs Hub; Jobs vs Work Orders)

**Severity:** Blocking  
**Evidence (SOURCE):**

- Live `command-center/src/components/BHFSidebar.jsx`: sectioned IA; Hub at `/crm`; Jobs labeled **Work Orders** at `/crm/jobs`; Analytics at `/crm/reporting`; no flat primary strip matching Next-Phase.
- Live routes: `dashboard` is an alias of `CRMHub` (`App.jsx`), not a separate screen.
- Packet conflict: Brief target = “Dashboard → CRM/Hub → …”; PD-UX-01 = “Dashboard/Hub → Jobs → …”; Next-Phase §4 = “Dashboard → CRM → …”.

**Required fix:** Bind a single primary ordered list in Findings + PD-UX-01, including:

1. Whether **Hub** and **Dashboard** are one nav item (recommended: one entry, label Hub or Dashboard, route `/crm`, keep `dashboard` alias).
2. Display label for `/crm/jobs`: **Jobs** vs retain **Work Orders** (and whether page `<h1>` / document title follow nav).
3. Analytics label + path (`Analytics` → `/crm/reporting` vs rename route — prefer label-only this slice).
4. Explicit secondary-below-divider membership (at minimum: Leads, Call Console, SMS, Opportunities, Calendar, Dispatch, Invoices, Marketing, Partners, Ops).

Without this, A2 nav reorder will invent product naming.

### A-UX-03 — Legacy shell claim is false on the live CRM tree

**Severity:** Blocking (accuracy)  
**Evidence (SOURCE):** Findings claim `CrmLayout.jsx` / `EnterpriseLayout.jsx` are “Not mounted on live CRM tree.”  
`command-center/src/App.jsx` mounts `ContactsPage` under `BHFCrmLayout`. `ContactsPage.jsx` still wraps UI in `EnterpriseLayout` (nested shell). Other `EnterpriseLayout` / `CrmLayout` pages exist but are largely unrouted; Contacts is enough to falsify the claim.

**Required fix:** Correct as-is table:

- Live shell = `BHFCrmLayout` + `BHFSidebar` + inline mobile header/bottom nav.
- `EnterpriseLayout` remains reachable via at least Contacts (nested); do not revive *additional* mounts.
- Optional delete/quarantine only after import+route graph proof; Contacts nested usage is a residual (not in-slice chrome for top 5, but must not be described as unused).

---

## Findings (non-blocking / must track)

### A-UX-04 — Shell/nav/token approach is feasible if scoped to aliases + chrome

**Assessment:** Feasible.

- Mobile bottom bar already exists inline in `BHFCrmLayout` (`Hub · Leads · Quotes · Calendar · Invoices`) — PD-UX-02 A is a list swap + More overflow, not a new shell invention. Extracting `MobileBottomBar` is optional.
- Token strategy PD-UX-03 A matches existing `command-center/src/index.css` shadcn HSL + `.dark`. Shell/sidebar still use hard-coded `slate`/`blue`/hex tenant forks — aliases alone will not meet “no one-off hex sprawl” unless success criteria require **shell + top 5** to consume aliases for brand surfaces, or SC is narrowed to “aliases defined + top 5 headers/toolbars.”
- PD-UX-06 A (no dark toggle) correctly shrinks scope vs Next-Phase §4 wishlist.

**Residual:** Document demo/installworxs hard-coded theme branches in `BHFCrmLayout` (and `TENANT_ID = DEFAULT_TENANT_ID` theme bug) as out-of-slice or chrome-only; do not expand into multi-tenant theming.

### A-UX-05 — Consolidation depth PD-UX-05 A is the right depth

**Assessment:** Approve depth choice.

Top 5 headers today are ad hoc (`CRMHub` / `Jobs` / `ProposalList` / `Settings` each roll their own title+actions). Shared `CrmPageHeader` + thin `CrmListToolbar` is proportionate. PD-UX-05 B (generic DataTable) would pull Jobs financial columns / payment actions into a framework — incompatible with money-state freeze.

**Required coding guard (residual, not re-plan):** A2 touch on `Jobs.jsx` / Quotes list / Settings = chrome wrappers only; forbid edits to payment, delete, status, billing-flag, or inspection completion handlers. Settings top-5 includes `BillingPaymentsSettings` — header/tabs chrome only; no default flips.

### A-UX-06 — No-migration constraint integrity

**Assessment:** Intact across Brief, PD (Founder-fixed), Baton (`db_migrations: forbidden`), Findings, Evidence.

No schema/RLS/Edge/RPC *changes* proposed. Existing sidebar `check_is_superuser` RPC read may remain. Floating +Create (PD-UX-04) must be navigate-to-existing-create-routes only (no new writers).

**Residual:** Parallel S8 Mobile Inspections may own `/inspections/*` product work while this slice owns Inspections **list chrome**. Add an explicit fileset boundary (e.g. UX-REFACTOR: `Inspections.jsx` list header/toolbar only; S8: editor/sync/offline) to the risk register / residuals.

### A-UX-07 — Risk register gaps

Add before A2:

| Risk | Mitigation |
| --- | --- |
| Wrong tree edit (`src/` vs `command-center/src`) | Path pin + PR path allowlist |
| Jobs/Settings chrome edit regresses money UX | Diff discipline; no handler changes; Playwright smoke only |
| S8 overlap on Inspections | Fileset ownership in residual register |
| Nav label churn (Work Orders ↔ Jobs) | Bind in PD-UX-01 |

---

## What already looks good

- One-sentence goal and in/out table keep Photo Bundles, S7, Stripe auto-send/charge, TIS, migrations out.
- Top 5 route → primary file mapping matches live `App.jsx` lazy imports (`CRMHub`, `Jobs`, `ProposalList`, `Inspections`, `Settings`).
- PD-UX-02 A aligns mobile primaries with office top 5 better than current Leads/Calendar/Invoices bar.
- Evidence manifest correctly non-claims production UI / Hostinger from planning alone.
- Risk tier Tier 2 + frontend-only posture is appropriate if money/inspection gates stay untouched.

---

## Disposition

| Item | Status |
| --- | --- |
| Verdict | **CHANGES REQUIRED** |
| Exact HEAD reviewed | `344edc7af65bf07405bb4ca25a1f28783dba23c1` |
| Re-review trigger | Fix A-UX-01…03 in Findings + Brief/PD alignment; add A-UX-06/07 residuals; then Architecture re-check same branch HEAD |

**Authorized next state after remediation:** Architecture may APPROVE planning; A2 coding remains gated on full 3-lane peer APPROVE + CI per baton (not granted by this review).
