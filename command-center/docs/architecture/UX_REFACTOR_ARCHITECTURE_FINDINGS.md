# UX-REFACTOR — Architecture Findings

| Field | Value |
| --- | --- |
| Base | `a12b0f4502fe668a900381753128e9e4724cd844` |
| Migrations | None |

## Current system (as-is)

| Layer | Location | Notes |
| --- | --- | --- |
| CRM shell | `src/components/BHFCrmLayout.jsx` | Drawer sidebar, mobile header, bottom bar |
| Nav | `src/components/BHFSidebar.jsx` | Sectioned links; order ≠ Next-Phase target |
| Tokens | `src/index.css` + `tailwind.config.js` | shadcn HSL variables; `.dark` present |
| UI kit | `src/components/ui/*` | Button, Card, Table, Dialog, Tabs, Sheet… |
| Routes | `src/App.jsx` | `/:tenantId/crm/*` under `BHFCrmLayout` |
| Legacy shells | `CrmLayout.jsx`, `EnterpriseLayout.jsx` | Not mounted on live CRM tree — do not revive |

## Target structure (to-be)

```
BHFCrmLayout
  ├─ BHFSidebar (IA order PD-UX-01)
  ├─ MobileHeader
  ├─ Outlet
  │    └─ CrmPageHeader + page body (top 5)
  └─ MobileBottomBar (PD-UX-02)
```

New shared (A2):

- `src/components/crm/CrmPageHeader.jsx`
- `src/components/crm/CrmListToolbar.jsx` (optional thin)
- Semantic token aliases in `index.css`

## Constraints

- **No** Supabase migrations, RLS, Edge, or RPC changes.  
- **No** money-state or inspection gate logic changes (Inspections list chrome only).  
- Prefer composing existing `components/ui` primitives.  
- Delete or quarantine unused legacy shells only if zero import graph (optional cleanup; not required).

## Risk register (planning)

| Risk | Mitigation |
| --- | --- |
| Nav reorder breaks muscle memory | Keep all destinations; divider for secondary |
| Token change regresses contrast | Visual smoke + axe/contrast spot-check on top 5 |
| Scope creep into full redesign | Hard stop at top 5 + shell |
| Parallel ML-P1 work conflicts | Frontend-only files; avoid migration folder |

## Test approach

- Unit/source guards for nav order + token aliases  
- Playwright: load top 5 under mobile + desktop viewports; assert header + nav landmarks  
- No DB integration tests required
