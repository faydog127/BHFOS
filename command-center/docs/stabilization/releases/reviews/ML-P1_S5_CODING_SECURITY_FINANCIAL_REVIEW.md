# ML-P1 S5 Coding — Round 2 Review (Security / Financial Control)

| Field | Value |
| --- | --- |
| Target | S5 invoice RPCs + client authz + alt-writer denials |
| Verdict | **APPROVE** (SOURCE-ONLY + unit EXECUTED) |

## Findings

- Role gates via `ml_p1_s2_current_actor_role` (not client-supplied role on RPCs).
- Tech denied create/issue/void/write-off at client helper; void requires reason; paid blocks void.
- Issued financial columns blocked by `ML_P1_S5_ISSUED_IMMUTABLE` (void+reissue only).
- Create never reads `price_book`; snapshot stamps `pricebook_used=false`.
- Mutation idempotency ledger on create/issue/void.

## Residuals

- Service-role can invoke SECURITY DEFINER RPCs — grants match prior slices; A3 should confirm live grants.
- Write-off mutation path not shipped (admin capability only) — R-S5-06.
