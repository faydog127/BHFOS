# ML-P1 Slice 8 Remediation — A3 Closeout

| Field | Value |
| --- | --- |
| Disposition | **SLICE8_PRODUCTION_VALIDATION_PASS** |
| Founder auth | Merge PR #111 @ `d06198296c68edce8ab81bc0e534018087480896` + A3 migrate/deploy/validate |
| Merge commit | `98cdee15c09ed5511f16cff9ea116cab052c92f8` |
| Migration `20260723200000` | **APPLIED** · SHA-256 `7EBAB73E39F48B8B6A4058C476456A2751A15C08DE3DF15369E157E1A5349CBE` |
| Hotfix `20260723201000` | **APPLIED** · SHA-256 `3B7F975AB64EB121D17896A800FB9E0796CE1403636429F7E6AF4CC54828DEC4` |
| Hostinger | **HEALTHY** @ `98cdee15c09ed5511f16cff9ea116cab052c92f8` · `migrationVersion=20260723200000` (UI tip; DB includes `201000`) |
| Project | `wwyxohjnyqnegzbxtuxs` |

## Hotfix note (auth integrity)

Post-apply JWT validation found `SECURITY DEFINER` used `current_user` (function owner) as a privilege bypass, skipping JWT tenant/role checks. Hotfix `20260723201000` restricts privilege to `auth.role() = 'service_role'` only. Re-validated after apply.

## Validation evidence

| Suite | Result |
| --- | --- |
| JWT isolation + role + gates (`tools/ml-p1-s8-remediation-prod-validation.mjs`) | **PASS** (evidence JSON under `docs/stabilization/releases/evidence/`) |
| Mobile E2E (`tests/smoke/ml-p1-s8-remediation-mobile-e2e.spec.js` @ `https://app.bhfos.com`) | **PASS** (1/1) |
| Health probe | **HEALTHY** @ merge tip |

## Explicit non-claims / not authorized

- Photo Bundles — not started  
- Slice 7 — not started  
- Stripe auto-charge — remains OFF / not enabled  
- Further feature work — not authorized by this closeout  

## Acceptance

Functional, security (post-hotfix), and field-mobile validation for Slice 8 remediation: **PASS**.
