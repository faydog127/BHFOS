# UX-REFACTOR — Architecture Findings

| Field | Value |
| --- | --- |
| Base | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Migrations | None |
| Code root | **`command-center/src/` only** (never repo-root `src/`) |

## Current system (as-is)

| Layer | Location | Notes |
| --- | --- | --- |
| CRM shell | `command-center/src/components/BHFCrmLayout.jsx` | Drawer sidebar, mobile header, bottom bar |
| Nav | `command-center/src/components/BHFSidebar.jsx` | Sectioned; primary order ≠ target |
| Tokens | `command-center/src/index.css` + `tailwind.config.js` | shadcn HSL; `.dark` present |
| UI kit | `command-center/src/components/ui/*` | Button, Card, Table, Dialog, Tabs, Sheet… |
| Routes | `command-center/src/App.jsx` | `/:tenantId/crm/*` under `BHFCrmLayout` |
| Nested legacy chrome | `EnterpriseLayout` still used by some pages (e.g. Contacts / SettingsPage / ReportsPage variants) | **In scope to stop nesting on top-5 paths only**; do not claim unmounted globally |

## Canonical primary IA (binds PD-UX-01)

1. Hub → `/crm`  
2. Work Orders → `/crm/jobs`  
3. Quotes → `/crm/quotes`  
4. Inspections → `/crm/inspections`  
5. Analytics → `/crm/reporting`  
6. Settings → `/crm/settings`  

## Target structure (to-be)

```
BHFCrmLayout                    (command-center/src/components)
  ├─ BHFSidebar (canonical primary + divider + secondary)
  ├─ MobileHeader
  ├─ Outlet
  │    └─ CrmPageHeader + page body (top 5 only)
  └─ MobileBottomBar (Hub · Work Orders · Quotes · Inspections · More)
```

New shared (A2, under `command-center/src/components/crm/`):

- `CrmPageHeader.jsx`
- `CrmListToolbar.jsx` (thin; PD-UX-05 A)
- Semantic token aliases in `command-center/src/index.css`

## Constraints

- **No** Supabase migrations, RLS, Edge, or RPC changes.  
- **No** money-state or inspection completion-gate logic changes (Inspections **list chrome** only).  
- Settings top-5: **chrome/tokens only** — no typed billing settings / auto-charge UI.  
- Prefer composing existing `components/ui` primitives.  
- Do not edit repo-root `src/` tree in this slice.

## Risk register (planning)

| Risk | Mitigation |
| --- | --- |
| Nav reorder breaks muscle memory | Keep all destinations; divider for secondary |
| Wrong `src/` tree edited | Path pin + PR checklist |
| `EnterpriseLayout` double-chrome on Contacts | Out of top-5; residual R-UX-06 |
| Token change regresses contrast | Visual smoke on top 5 |
| Scope creep | Hard stop at shell + top 5 |

## Test approach

- Unit/source guards for nav order + `command-center/src` path pins + token aliases  
- Playwright: load top 5 under mobile + desktop; assert header + nav landmarks  
- No DB integration tests
