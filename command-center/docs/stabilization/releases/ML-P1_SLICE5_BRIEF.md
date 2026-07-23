# ML-P1 Slice 5 — Brief

| Field | Value |
| --- | --- |
| Slice | **ML-P1-S5** Invoice generation (canonical draft → issue) |
| Planning base | `e9cc3317fcb9c84f44643700927699f40c7f1a93` |
| Product decisions | **PD-S5-01…07 RATIFIED** 2026-07-23 |
| Coding | Not started · not authorized |
| Out of scope | Stripe/S5b · refunds · autonomous follow-up · TIS · G2.3 · multi-tenant |

## One-sentence goal

After a job is properly completed, create exactly one final draft invoice from approved quote + approved change orders, let office review and issue it (stored as `sent`, shown as “Issued”), and never silently change money after issue.

## In / out

| In | Out |
| --- | --- |
| Hybrid draft create (auto + office fallback) | Auto-send / auto-issue |
| Office issue → `sent` (“Issued”) | Deposit/progress invoice product |
| Quote-snapshot tax + draft tax correct | Silent reprice from pricebook |
| Void+reissue corrections | In-place edit of issued amounts |
| Grandfather 25 live invoices | Historical rewrite |
| Deny alternate create writers | Stripe / refunds / dunning |

## Success criteria (when coding is later authorized)

1. Eligible completed job yields one `final` draft (auto or office).  
2. Issue freezes financials; display “Issued”; persist `sent`.  
3. Tech cannot create/void/write-off/edit money.  
4. Parallel create paths remain denied.  
5. Synthetic-only prod validation; cleanup after.

## Related artifacts

- Decision packet: `docs/governance/decisions/ML-P1_SLICE5_DECISION_PACKET.md`  
- Architecture / planning design / writer inventory / state ledger / evidence / residuals under `docs/stabilization/releases/ML-P1_SLICE5_*`
