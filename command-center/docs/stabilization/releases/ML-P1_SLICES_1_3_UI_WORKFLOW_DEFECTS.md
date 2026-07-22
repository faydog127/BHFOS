# ML-P1 Slices 1–3 — UI / Workflow Defect List

| ID | Defect | Severity | Disposition |
| --- | --- | --- | --- |
| D-01 | Quotes nav → Estimates path/page | High | Fixed (canonical `/crm/quotes`) |
| D-02 | Broken Accept path missing `/crm` | High | Fixed |
| D-03 | Lifecycle Back outside CRM tree | Medium | Fixed |
| D-04 | List Open bypassed lifecycle | Medium | Fixed (Open → lifecycle) |
| D-05 | “Actionable Estimates” label | Medium | Fixed → Actionable Quotes |
| D-06 | Stale sidebar build stamp | Low | Fixed (build-info.json) |
| D-07 | Reject hidden for `issued` on mobile | Medium | Fixed (parity with Accept) |
| D-08 | Filter chip showed “accepted” | Low | Fixed → Approved label |
| D-09 | ProposalBuilder still reachable by URL | Medium | Accepted residual (secondary) |
| D-10 | Orphan `Estimates.jsx` / `QuoteBuilder.jsx` not in CRMRoutes | Low | Dead code residual; redirect covers deep links |
| D-11 | Dual Edge vs RPC status updates | Medium | Accepted residual |
| D-12 | Superseded versions in main list | Medium | Open residual R-COH-12 |

## Quote list row actions (post-fix)

| Control | Behavior | Keep in primary set? |
| --- | --- | --- |
| Preview | Public/preview document | Yes |
| PDF / Print | Print view | Yes |
| Open / Edit icon | Lifecycle page | Yes (canonical) |
| Send / Resend | Edge document send | Yes (until RPC send lands) |
| Accept (check) | Navigate lifecycle (server approve there) | Yes |
| Reject | List Edge status update | Yes (note dual-path residual) |
| Delete | moneyLoopDeleteService + confirm | Yes (destructive; confirmed) |
