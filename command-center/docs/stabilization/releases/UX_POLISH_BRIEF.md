# Slice UX-POLISH — Brief (A0/A1 planning)

| Field | Value |
| --- | --- |
| Slice | **UX-POLISH** — Brand foundation, shell finish, synthetic-data hygiene, Hub/table density, copy |
| Planning base | `7623948a7a312125842223e27dd6a39c3834b060` (`origin/main`) |
| Branch | `ml/ux-polish-planning` |
| Worktree | `F:\Dev\BHFOS-ux-polish` |
| Schedule | **Parallel** (does not start S7 / Photo Bundles) |
| DB migrations | **Forbidden** |
| Policy | Peer review ×3 → CI → auto-continue (Delegated-Authority) |
| Founder create | 2026-07-23 — TVG CRM brand authority; PWA **out**; proceed with amended UX-POLISH |

## One-sentence goal

Make the CRM look and behave like **one TVG product**: one brand name, one token/type system, finished page chrome, trustworthy money/list queries (no synth bleed), and tighter Hub/table hierarchy — without migrations, PWA, or money-flow product changes.

## Brand (Founder-locked)

| Decision | Value |
| --- | --- |
| Product name in shell | **TVG CRM** (everywhere: mobile header, drawer, titles) |
| Do not use | “BHF CRM” as user-visible product name in CRM shell |

## Scope (binding)

| In | Out |
| --- | --- |
| Brand tokens + wire body font (Inter already loaded or chosen stack) | PWA / service worker / manifest install |
| Finish `CrmPageHeader` on Leads, Call Console, Calendar, Dispatch, Invoices | DB / Supabase migrations |
| Shared synthetic/test exclude helper on Hub money, Invoices, Jobs, Opportunities (+ Leads alignment) | Rebuilding Training Mode (already exists — wire helper only) |
| Hub first-viewport diet; equal Lead/Quote CTAs | Stripe / auto-send / auto-charge behavior |
| WO + Leads density pass | Storybook / Cypress / screenshot-diff CI farm |
| Copy: Quotes accepted vocabulary; Night Mode after-hours treatment | Photo Bundles · S7 · TIS |
| Bugfixes in-scope: Leads drawer open; pipeline stage unknown → correct mapping | Cloning Dispatch severity model onto every list |

Code root: **`command-center/src/`** only.

## Steps (A2)

| # | Step | Intent |
| --- | --- | --- |
| 1 | Brand foundation | `--brand-*` tokens; Tailwind wire; **TVG CRM** string |
| 2 | Shell consolidation | Header/breadcrumb on remaining office screens; one accent blue |
| 3 | Universal exclude helper | `isSynthetic` / exclude helper; lists + Hub/Invoices KPIs; reuse Training Mode |
| 4 | Hub diet | One hero job; KPIs secondary; equal CTAs |
| 5 | Table density | WO drop duplicate Unscheduled; Leads kebab actions |
| 6 | Copy | accepted vs approved; Night Mode moon/after-hours only |

## Success criteria

1. No user-visible “BHF CRM” in CRM shell; TVG CRM only.  
2. Shared header pattern on all listed office screens.  
3. Live lists/KPI money paths exclude synth/test via one helper (Training Mode still shows test-only when on).  
4. Hub first viewport is not seven equal KPI cards.  
5. Leads drawer opens on row click; pipeline stage warnings reduced/mapped.  
6. No migrations; no PWA; peer APPROVE ×3 + CI before merge.  
7. Hostinger only with Access Matrix **S**.

## Escalation (Major Decision)

- Changing payment/auto-send/auto-charge defaults  
- Schema migrations / RLS  
- Expanding into PWA or full redesign beyond listed steps  
- Renaming product away from TVG CRM  

## Related artifacts

- Decisions: `docs/governance/decisions/UX_POLISH_DECISION_PACKET.md`  
- Architecture: `docs/architecture/UX_POLISH_ARCHITECTURE_FINDINGS.md`  
- Evidence: `docs/stabilization/releases/UX_POLISH_EVIDENCE_MANIFEST.md`  
- Residuals: `docs/stabilization/releases/UX_POLISH_RESIDUAL_REGISTER.md`  
- Baton: `docs/governance/RELEASE_BATON.ux-polish.yaml`
