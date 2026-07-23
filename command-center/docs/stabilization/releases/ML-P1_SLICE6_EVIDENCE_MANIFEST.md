# Evidence Manifest — ML-P1 Slice 6 A3

| Field | Value |
| --- | --- |
| Scope | Stripe settlement settings + Checkout/offline/refund/recon gates (no auto-charge, no vault) |
| Exact deployed SHA | `206e1411ce89674a9875070586f7e1572d86acc8` |
| A2 merge | PR #104 → `d73f975…`; tip includes next-phase docs PR #105 |
| Disposition | **A3 STRUCTURAL PASS** · Full-Threat **BLOCKED_PENDING_STRIPE_TEST_KEYS** |

## Artifacts

| Path | Role |
| --- | --- |
| `docs/governance/decisions/ML-P1_SLICE6_A3_APPLY_PACKET.md` | Exact apply set |
| `docs/stabilization/releases/ML-P1_SLICE6_A3_POSTAPPLY_CLOSEOUT.md` | Closeout |
| `docs/stabilization/releases/ML-P1_SLICE6_FULL_THREAT_E2E_REPORT.md` | E2E disposition |
| `docs/governance/ML-P1_ORCHESTRATOR_ACTIVE_PROMPT.md` | Reconciled orchestrator posture |
| Migration `20260723140000_ml_p1_s6_payment_settings.sql` | SHA-256 `1E268248…FFB0D9` |

## EXECUTED

- Linked SQL apply of S6 migration; I2 object/flag/RLS/auto-charge deny probes  
- Edge redeploy of pay + webhook surfaces  
- Hostinger CRM deploy; health-probe **HEALTHY** @ `206e141`  
- Unit 8/8; webhook spoof reject  

## Explicit non-claims

No live Checkout charge/refund/dispute · no secret rotate · no auto-charge enable · no vault/Terminal · no S8 start.
