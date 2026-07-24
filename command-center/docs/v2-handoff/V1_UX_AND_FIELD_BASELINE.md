# V1 UX and Field Usability Baseline

Distinguish evidence: **live-verified** (this session / production build-info or authenticated E2E in closeout docs) · **source-only** · **reviewer observation** · **unverified claim**.

| Surface | Confirmed V1 state | Evidence class |
| --- | --- | --- |
| Desktop shell | CRM shell with sidebar primary nav (Hub → Work Orders → Quotes → Inspections → Analytics → Settings) on prod tip | live-verified (deploy closeout markers) + repository @ `c469f7c` |
| Mobile shell | Bottom bar Hub · Work Orders · Quotes · Inspections · More | repository @ prod tip; live markers in UX-REFACTOR A3 closeout |
| Product naming | **BHF CRM** on prod mobile header | repository @ `c469f7c` (`BHFCrmLayout.jsx`); **source-only on main is TVG CRM (undeployed)** |
| Brand consistency | Split era: TVG in some titles, BHF CRM in shell on prod | live-verified HTML title “The Vent Guys CRM” + repo BHF CRM string |
| Typography | Inter loaded; body wiring completed on main (UX-POLISH); prod tip may still under-use Inter | source-only for full token wire on main |
| Color tokens | shadcn slate primary on prod tip; brand accent tokens on main | source-only drift |
| Page headers | `CrmPageHeader` on top office screens (UX-REFACTOR); expanded on main | repository + deploy markers |
| Navigation structure | Canonical primary nav locked in UX-REFACTOR | repository |
| Mobile bottom navigation | Inspections in 5th money-adjacent slot on prod; Invoices promoted on main (UXV2) | repository drift |
| Quotes mobile quality | Gold sample (Dispatch & Quotes) | reviewer observation + prior critiques |
| Dispatch quality | Gold sample | reviewer observation + prior critiques |
| Hub density | Equal-weight KPI strip on prod tip; Today hero + KPI toggle on main | repository drift |
| Work Order density | Improved on main (UX-POLISH); prod tip earlier state | repository drift |
| Leads behavior | Drawer race / stage mapping fixed on main; **prod tip unverified** | source-only fix undeployed |
| Invoices behavior | Canonical S5/S6 flows; UI hygiene filter undeployed | mixed |
| Calendar behavior | Booking source-of-truth messaging present | repository |
| Call Console behavior | Specialized full-height tool; header polish on main | repository |
| Inspections behavior | S8 remediation production-validated; search card→toolbar on main only | documentary + drift |
| Accessibility | Shared headers help; KPI toggle a11y on main; full axe farm deferred | reviewer / source |
| Installability | **Not a productized PWA** | deferred policy |
| Offline behavior | Partial inspection/offline cache; not full offline field app | documentary + residual |

## Field usability verdict (Product lens)

V1 is **usable for core TVG office + inspection field loop** on production (quotes → job → schedule/dispatch → inspect → invoice draft/issue → Checkout/offline pay), with known friction:

- Shell brand inconsistency (BHF CRM).  
- Hub KPI noise / synth pollution risk on prod UI.  
- Change-order customer token UI incomplete.  
- Write-off incomplete.  
- Photo Bundles / full offline / PWA not available (deferred, not defects).

## V2 must not treat as “already done on prod”

- TVG CRM brand unification  
- Hub Today rewrite  
- Shared synthetic exclude on money lists  
- Mobile Invoices one-tap  
- Percy visual baselines (scaffold only; token-gated)
