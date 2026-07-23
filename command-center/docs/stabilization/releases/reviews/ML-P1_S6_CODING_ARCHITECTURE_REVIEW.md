# ML-P1 S6 Coding — Round 1 (Architecture)

| Verdict | **APPROVE** (SOURCE-ONLY) |
| --- | --- |
| Findings | Runtime flags in `global_config`; writers read without redeploy; Checkout-only; recon queue additive; S5 invoice create untouched. |
| Residual | Prod apply / Edge redeploy remain A3. |
