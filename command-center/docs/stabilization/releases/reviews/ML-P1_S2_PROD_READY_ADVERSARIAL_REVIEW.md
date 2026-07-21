# ML-P1 S2 Prod-Readiness — Adversarial Test (PR #79)

| Field | Value |
| --- | --- |
| Frozen head | `c8e721d3d296b0258026bd319deffccc79a1792c` |
| Verdict | **PASS** |

| Case | Result |
| --- | --- |
| Clean apply vs live schema (no `quotes.notes`) | PASS (source) |
| Revise without notes | PASS (allowlist test) |
| Accepted→job denial when gate off | PASS (deferred + gated INSERT) |
| Paid→job denial when gate off | PASS (deferred + gated INSERT) |
| Concurrent approve/revise | PASS (unit + SQL predicates) |
| Public-token replay | PASS (unit) |
| Customer vs break-glass RPCs | PASS (unit) |
| Legacy estimates writer | PASS (DENY) |

Executed: `npm run test:ml-p1-s2-helpers` 22/22. Live DB apply not run (not authorized).
