# Founder Delegated-Authority Policy — ML-P1

| Field | Value |
| --- | --- |
| Version | v2026-07-22 |
| Effective | 2026-07-23 (Founder paste into Orchestrator) |
| Authority | Founder Erron |
| Scope | ML-P1 Slice 5 → S N (incl. S6 Stripe, S7 follow-up/warranty) + S1–S4 residual remediation |

## Purpose

Preserve Founder focus by letting the Program Orchestrator finish remaining ML-P1 slices end-to-end without pausing for minor checkpoints. Escalate **only** for Major Decisions.

## Continue-automatically when

- Peer-review lanes return APPROVE or PASS after remediation.
- Migration checksums match the frozen SHA in the apply packet.
- Synthetic production-validation PASS with **no real-customer mutations**.
- Action stays inside previously-ratified PD packets or this policy.

## Escalate (prompt Founder) only when

1. Pricing or discount **changes > ±3 %** on any active service.
2. Introducing net-new customer-facing flows (e.g. portal, autopay).
3. Turning **invoice auto-send or auto-charge** *ON* for real customers.
4. Any schema migration that **drops columns / tables** or rewrites historical financial data.
5. External contract, regulatory, or data-residency implications.
6. A production validation **FAIL** that impacts money, auth, or data integrity and cannot be hot-fixed safely.
7. Aggregate estimated cost > 4 dev-days or third-party spend > $300.

## Default for non-major questions

Choose the option that maintains consistency with HCP, reduces re-work, and aligns with existing governance patterns — **without asking**.

## Auto-continue pipeline

open PR → 3-round peer review → merge after CI-green (Category C) → apply migrations (A3) → synthetic prod validation → Hostinger deploy → ledger & evidence docs.

Update `ML-P1_STATE_LEDGER.md` and Evidence manifest every step. Commit docs under `docs/governance/…` as you go.

## Escalation format

```
**ESCALATION – MAJOR DECISION REQUIRED**

Slice X  · Packet ID …  · main SHA …

• What changed / why the auto-continue rule stops here.
• 1-paragraph impact summary (risk, cost, customer hit).
• Exactly what you need decided (bullet list of options).
```

## Binding non-defaults under this policy

- Do **not** enable invoice auto-send or auto-charge for real customers without escalation #3.
- Do **not** drop columns/tables or rewrite historical financials without escalation #4.
- S5 auto-draft remains draft-only (PD-S5-01); issue stays explicit office action.
