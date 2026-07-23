# ML-P1 S6 Coding — Bugbot Critique

| Field | Value |
| --- | --- |
| Target | `ml/p1-s6-stripe-settlement` uncommitted A2 |
| Agent | [Bugbot](34936228-d368-46a2-8efa-7af7201b6795) |

## Findings remediated

| Severity | Finding | Fix |
| --- | --- | --- |
| High | Offline RPC missing role authz | Role + JWT tenant checks |
| High | Refund lacking idempotency | `payment_execution_mutations` ledger |
| High | Refund missing tenant check | JWT tenant vs invoice.tenant_id |
| High | Recon queue missing RLS | ENABLE RLS + tenant select policy |
| Medium | Auto-charge flag settable ON | Setter raises `ML_P1_S6_AUTO_CHARGE_DENY` |
| Medium | Checkout kill-switch fail-open | Fail closed on config read error |

## Accepted residual

| Severity | Finding | Disposition |
| --- | --- | --- |
| Medium | Full refund → `sent` allows recollect | **ACCEPT** — intentional (office may collect again after refund; not silent reopen) |

## Verdict

**PASS after remediation** (SOURCE-ONLY)
