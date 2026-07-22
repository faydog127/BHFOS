# ML-P1 S4 — Security Review

| Field | Value |
| --- | --- |
| Verdict | **APPROVE** (SOURCE-ONLY + unit EXECUTED for client deny) |
| Evidence class | Mixed |

## Findings

- Deny-by-default capability helper; role from `ml_p1_s2_current_actor_role` (not client-supplied).
- Assignment check for technician field actions.
- Break-glass requires reason + customer auth proof.
- Alt-writer trigger blocks status/schedule/tech/money updates without writer context.
- Edge no longer mutates execution fields (409 canonical writer).

## Residuals

- Service-role can still call RPCs; production grants should remain authenticated+service_role only (as written).
- R-S3-01 service_role insert residual remains from prior slice.
