# ML-P1 S6 Planning — Round 2 Review (Security / PCI / Financial Control)

| Field | Value |
| --- | --- |
| Target | Secrets, PCI surface, paid-writer integrity, refunds/disputes |
| Verdict | **APPROVE** |

## Findings

- PD-S6-01 A keeps secrets server-side; no Vite publishable charge path — correct for Checkout-only.
- PD-S6-03 A avoids card vault / Elements → minimizes PCI SAQ scope creep.
- PD-S6-05 A + G-09 focus is mandatory; alternate paid writers are the top money-integrity risk.
- Refunds as office-initiated + dispute quarantine avoids silent webhook money edits.
- Escalation table correctly binds auto-charge, portal/Terminal, and historical rewrite.

## Residual

- Live `payments_mode=stripe` means misconfigured coding could charge real cards — A2 must keep feature flags / synth gates.
- Dual Stripe Invoice path in `send-invoice` needs coding inventory (R-S6-02).
