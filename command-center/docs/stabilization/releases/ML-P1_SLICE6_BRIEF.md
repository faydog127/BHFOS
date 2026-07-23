# ML-P1 Slice 6 — Brief

| Field | Value |
| --- | --- |
| Slice | **ML-P1-S6** Stripe settlement & payment posting |
| Planning base | `a7e1f63781cca7fcba5d706a7a97bd62a17a4c3b` (`origin/main`) |
| Branch | `plan/ml-p1-s6-stripe-settlement` |
| Product decisions | **PD-S6-01…07 DRAFT → Founder Category-C review** (not coding-authorized) |
| Coding / migrate / deploy | **Blocked** until Founder Category-C |
| Naming | Roadmap historically called this **S5b**; Founder delegated policy + this packet rename it **S6**. Former roadmap S6 (autonomous follow-up) → **S7**. |

## One-sentence goal

Collect payment on issued invoices via Stripe (and offline posting) with a single canonical paid writer, without enabling automatic card charges or new customer autopay portals.

## In / out

| In | Out (this slice) |
| --- | --- |
| Prove G-09 one paid writer (webhook + offline) | Auto-charge / autopay / scheduled capture |
| Harden Checkout pay-link settlement | New payment providers (Braintree, etc.) |
| Office full/partial refund surface + Stripe API | Full chargeback automation product |
| Dispute webhook → quarantine / task only | Card vault / SetupIntent / Elements field collect |
| Partial-pay status coherence (`partially_paid`) | Autonomous follow-up / dunning journeys (S7) |
| Recon exception queue + observations sweep | QuickBooks ownership expansion |
| Tech: share pay link / view balance only | Tech device card entry / Terminal |

## Success criteria (when coding later authorized)

1. All Stripe settlements and offline payments converge on the same paid writer(s); no alternate paid mutators.  
2. Customer pay remains hosted Checkout via `/pay/:token`; no auto-charge.  
3. Refunds (full/partial) office-initiated with audit; disputes create exceptions, not silent money edits.  
4. Invoice/job payment status stay coherent after settlement.  
5. Synthetic validation only; no real-customer mutation in synth.

## Escalation triggers (Founder Major Decision)

- Turning **auto-send** or **auto-charge** ON for real customers  
- Net-new customer portal / saved-card / Terminal field flows  
- PCI scope expansion (Elements on our domain) or data-residency changes  
- Destructive schema / historical financial rewrite  

## Related artifacts

- Decision packet: `docs/governance/decisions/ML-P1_SLICE6_DECISION_PACKET.md`  
- Architecture: `docs/stabilization/releases/ML-P1_SLICE6_ARCHITECTURE_FINDINGS.md`  
- Reviews: `docs/stabilization/releases/reviews/ML-P1_S6_PLANNING_*_REVIEW.md`
