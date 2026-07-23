# ML-P1 S6 Planning — Round 3 Review (Architecture)

| Field | Value |
| --- | --- |
| Target | Existing spine vs target architecture; scope boundary |
| Verdict | **APPROVE** |

## Findings

- Architecture findings match EXECUTED live reads and SOURCE inventory (Checkout + webhook + offline RPC).
- Recommended target reuses spine rather than inventing PaymentIntent/Elements — lower re-work.
- Clear S5 vs S6 writer boundary (create/issue/void vs settle/refund).
- Non-scope keeps S7 follow-up and provider sprawl out.
- Stub `create-payment-intent` correctly treated as non-product.

## Residual

- KI-06 job/invoice payment_status coherence needs an explicit coding acceptance test.
- Prove webhook idempotency + refund ledger under load in A2/A3, not claimed here.
