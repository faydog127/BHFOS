# Slice UX-REFACTOR — Brief (A0/A1 planning)

| Field | Value |
| --- | --- |
| Slice | **UX-REFACTOR** — Global shell, navigation, design tokens, component consolidation |
| Planning base | `a12b0f4502fe668a900381753128e9e4724cd844` (`origin/main`) |
| Branch | `ml/ux-refactor-planning` |
| Worktree | `F:\Dev\BHFOS-ux-refactor` |
| Schedule | **Parallel** with ML-P1 residuals (does not block S7 / Photo Bundles; those stay deferred) |
| DB migrations | **Forbidden** in this slice |
| Policy | Same as ML-P1: 3-lane peer review → CI green → auto-continue under Delegated-Authority |
| Founder create | 2026-07-23 — scope + parallel + no migrations + auto-continue |

## One-sentence goal

Unify CRM shell chrome, navigation IA, design tokens, and shared page patterns across the top five office screens so the product feels one system—without schema changes, money-flow edits, or new product pillars.

## Scope (binding)

| In | Out |
| --- | --- |
| Global shell (`BHFCrmLayout`, mobile header/bottom bar) | DB / Supabase migrations |
| Left nav order + labels (`BHFSidebar`) | Photo Bundles product |
| Design tokens (`index.css` / Tailwind theme) + token usage on top 5 | Slice 7 warranty/dispatch |
| Component consolidation for list/header/+Create/breadcrumb patterns on top 5 | Stripe / auto-send / auto-charge |
| Responsive polish for those surfaces | TIS merge · multi-tenant redesign |
| Docs + visual/regression smoke for shell/nav | New Edge functions · RLS changes |

## Top 5 screens (this slice)

| # | Screen | Route | Primary file (command-center) |
| --- | --- | --- | --- |
| 1 | Hub | `/:tenantId/crm` | `command-center/src/pages/crm/CRMHub.jsx` |
| 2 | Work Orders | `/:tenantId/crm/jobs` | `command-center/src/pages/crm/Jobs.jsx` |
| 3 | Quotes | `/:tenantId/crm/quotes` | `command-center/src/pages/crm/proposals/ProposalList.jsx` |
| 4 | Inspections | `/:tenantId/crm/inspections` | `command-center/src/pages/crm/Inspections.jsx` |
| 5 | Settings | `/:tenantId/crm/settings` | `command-center/src/pages/crm/Settings.jsx` |

All A2 paths are under **`command-center/src/`** (not repo-root `src/`, which is a divergent legacy shell).

## Target nav IA (canonical — binds PD-UX-01)

Primary desktop left-nav (above divider), using **live route paths** and **display labels**:

| Order | Label (UI) | Path |
| --- | --- | --- |
| 1 | Hub | `/crm` |
| 2 | Work Orders | `/crm/jobs` |
| 3 | Quotes | `/crm/quotes` |
| 4 | Inspections | `/crm/inspections` |
| 5 | Analytics | `/crm/reporting` |
| 6 | Settings | `/crm/settings` |

Secondary (below divider; all remain linked): Leads, Call Console, SMS Inbox, Opportunities, Calendar, Dispatch, Invoices, Marketing, Partners, Ops Dashboard.

**Naming rule:** Prefer live labels (**Hub**, **Work Orders**, **Analytics**) over synonyms (Dashboard/Jobs/Reporting) in UI copy. Docs may say “Jobs screen” meaning Work Orders route.

**Settings boundary:** Top-5 Settings work is **chrome/tokens/layout only** — no new typed billing/pricing settings UI, no flag flips for auto-send/auto-charge.

## Success criteria (A2 later)

1. One shell composition: shared page header, title, breadcrumb, and primary CTA slot on all top 5.  
2. Nav matches ratified IA; mobile bottom bar aligned to the same primary set (or documented exception).  
3. Design tokens defined as CSS variables; top 5 consume tokens (no one-off hex sprawl for brand surfaces).  
4. Shared list/toolbar patterns consolidated (no three incompatible table chrome styles on Hub/Jobs/Quotes).  
5. No migrations; no money-state behavior changes; Playwright smoke for shell/nav + top 5 load.  
6. Peer reviews APPROVE + CI green before merge; Hostinger only after Founder/deploy gate per Access Matrix (auto-continue may merge docs/code PRs when CI green; production deploy still follows matrix **S** unless Founder extends auth).

## Escalation (Major Decision)

- Changing payment/auto-send/auto-charge defaults  
- Schema migrations or RLS changes  
- Expanding beyond top 5 + shell into full app redesign  
- Dark-mode as default for all users (opt-in toggle OK if PD-UX ratifies)

## Related artifacts

- Decisions: `docs/governance/decisions/UX_REFACTOR_DECISION_PACKET.md`  
- Architecture: `docs/architecture/UX_REFACTOR_ARCHITECTURE_FINDINGS.md`  
- Evidence: `docs/stabilization/releases/UX_REFACTOR_EVIDENCE_MANIFEST.md`  
- Residuals: `docs/stabilization/releases/UX_REFACTOR_RESIDUAL_REGISTER.md`  
- Baton: `docs/governance/RELEASE_BATON.ux-refactor.yaml`
