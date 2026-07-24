# UX-POLISH — Architecture Findings

| Field | Value |
| --- | --- |
| Base | `7623948a7a312125842223e27dd6a39c3834b060` |
| Predecessor | UX-REFACTOR (nav IA + partial chrome + token aliases) @ prod `c469f7c` / tip pin closeout |

## Current posture

| Layer | State |
| --- | --- |
| Nav IA | Done (UX-REFACTOR) — do not reorder |
| Brand strings | Split: mobile “BHF CRM” vs drawer “TVG CRM” |
| Tokens | shadcn slate `--primary`; aliases `--nav-active`/`--cta` generic blue; Inter `@font-face` unused |
| Chrome | `CrmPageHeader` on Hub / Jobs / Quotes / Inspections / Settings only |
| Test data | Dispatch: `dispatchRules.isLegacyExcluded`. Leads: Training Mode + `is_test_data`. Jobs / Invoices / Hub KPIs / Opportunities: **no shared exclude** |
| Bugs | Leads drawer wired in source but reported not opening live; `normalizeStage` warns on unknown values |

## Target architecture (A2)

```
theme tokens (index.css + Tailwind)
        │
        ├── BHFCrmLayout / BHFSidebar  → "TVG CRM", brand accent
        ├── CrmPageHeader              → all office list/ops screens
        └── excludeSynthetic helper    → Hub KPIs, Invoices, Jobs, Opportunities, Leads
```

### Helper contract (binding)

- **Live mode:** exclude `is_test_data === true` and rows matching synth identity patterns (email `@example.com` / `@example.invalid`, name prefixes like `SYNTH`, `AEXEC`, `TVG Release Synthetic`, etc.).  
- **Training mode:** existing behavior — show test data only where already applied.  
- **Do not** apply Dispatch backlog-age exclusion to the full Work Orders table.

### Files of interest

| Area | Paths |
| --- | --- |
| Brand / tokens | `src/index.css`, `tailwind.config.js`, `BHFCrmLayout.jsx`, `BHFSidebar.jsx` |
| Header | `src/components/crm/CrmPageHeader.jsx` + Leads / CallConsole / Calendar / Schedule(Dispatch) / Invoices |
| Exclude helper | new `src/lib/excludeSynthetic.js` (or similar) + call sites |
| Hub | `CRMHub.jsx` |
| Density | `Jobs.jsx`, `Leads.jsx` |
| Copy | `ProposalList.jsx`, `kanbanUtils.js` |
| Drawer / stage | `Leads.jsx` |

## Non-goals

PWA, migrations, Edge/RLS, Storybook/Cypress farm, money-state product changes.
