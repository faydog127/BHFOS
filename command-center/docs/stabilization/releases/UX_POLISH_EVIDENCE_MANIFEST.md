# UX-POLISH — Evidence Manifest

| Field | Value |
| --- | --- |
| Slice | UX-POLISH |
| Base | `7623948a7a312125842223e27dd6a39c3834b060` |

## Evidence sources (planning)

| ID | Source | Use |
| --- | --- | --- |
| E1 | Live click-through 2026-07-23 (Cursor browser, desktop + 390×844) | Chrome gaps, dual brand, Hub density, Quotes pattern |
| E2 | Claude CSS inspection | Default shadcn `--primary` / unused font |
| E3 | Source: `Invoices.jsx` totals, `CRMHub.jsx` money sum | No `is_test_data` filter on KPIs |
| E4 | Source: `dispatchRules.isLegacyExcluded`, `Leads.jsx` training filter | Partial hygiene today |
| E5 | Source: `Leads.jsx` `handleLeadClick` + Sheet | Drawer bug is runtime, not missing wire |
| E6 | Founder create | TVG CRM locked; PWA out |

## A2 evidence required before merge

| Check | Method |
| --- | --- |
| Brand string | Source guard: no “BHF CRM” in CRM shell components |
| Tokens | Unit/source: `--brand-` / font-body present; Inter or body font applied |
| Header coverage | Source guard: CrmPageHeader on listed screens |
| Exclude helper | Unit tests for patterns + Training Mode polarity |
| Hub diet | Smoke/source: KPI strip not equal first-viewport hero |
| Drawer | Manual or Playwright: `?leadId=` + sheet open |
| No migrations | Diff contains zero `supabase/migrations` |
| No PWA | Diff contains no vite-plugin-pwa / service worker |

## A2 evidence captured (coding)

| ID | Artifact | Notes |
| --- | --- | --- |
| A2-E1 | `src/config/productBrand.js` | `CRM_PRODUCT_NAME = 'TVG CRM'` |
| A2-E2 | `src/lib/excludeSynthetic.js` | Shared live/training polarity helper |
| A2-E3 | `tests/unit/ux-polish-brand-hygiene.test.mjs` | Brand, headers, helper, Accepted, After hours |
| A2-E4 | Headers on Leads / Call Console / Calendar / Dispatch / Invoices (+ Opportunities) | `CrmPageHeader` |
| A2-E5 | Leads drawer race fix | Removed URL clear while selection still committing |
