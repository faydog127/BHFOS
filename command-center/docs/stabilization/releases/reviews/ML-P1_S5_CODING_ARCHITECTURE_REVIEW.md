# ML-P1 S5 Coding — Round 1 Review (Architecture / Scope / Source-of-Truth)

| Field | Value |
| --- | --- |
| Target | `ml/p1-s5-invoice-collection` coding vs base `8505a89` |
| Verdict | **APPROVE** (SOURCE-ONLY; migrations not applied) |

## Findings

- Canonical create/issue/void/readiness RPCs + auto-draft companion match PD-S5-01…07.
- Single writer intent preserved: Edge/MyMoney alternate creates denied; UI uses RPC facade.
- `final` only; persist `sent` / display Issued; quote snapshot tax; issued immutability trigger.
- No Stripe / payment / historical rewrite in scope.

## Residuals

- Write-off RPC deferred (R-S5-06) — capability + role helper present.
- Production apply / deploy remain Founder A3.
