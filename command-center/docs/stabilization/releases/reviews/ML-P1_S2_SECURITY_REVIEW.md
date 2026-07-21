# ML-P1 Slice 2 — Security Review

| Field | Value |
| --- | --- |
| Slice | ML-P1-S2 |
| Reviewer | _(Security — fill)_ |
| Verdict | **PENDING** |

## Controls

- **R-S1-03** server role matrix in `mlP1S2RoleAuthz.js` — UI hide ≠ authz.
- Deny: technician / viewer / partner / unauthenticated on office money mutations.
- Customer approve only via `APPROVE_CUSTOMER` or admin break-glass + `reason_code`.
- Tenant: session-required `resolveWriteTenantId` on office paths; public-token path binds tenant from token-validated row only.
- Estimates create DENY retained (S-04).

## Adversarial coverage (unit)

Unauthorized role, unauthenticated, missing tenant, illegal transitions, break-glass without reason, estimates create DENY.

## Residuals

- Edge `public-quote-approve` not yet forced through S2 service (cutover after A3 recommended).
- Live RLS negatives deferred until disposable/prod verify under later auth.
