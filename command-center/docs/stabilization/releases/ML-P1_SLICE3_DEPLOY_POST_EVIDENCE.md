# ML-P1 Slice 3 — Production Deploy Post-Evidence

> Founder authorized 2026-07-21. Tip `5cd7360aceb5492985cea6f3ff56253e5165bbea`.  
> Migration **not** reapplied.

## Disposition

# **SLICE3_DEPLOY_EXECUTED — IDENTITY PASS / MONEY-PATH OPERATOR PENDING**

## Surfaces deployed

| Surface | Result |
| --- | --- |
| Edge `public-quote-approve` | **DEPLOYED** · project `wwyxohjnyqnegzbxtuxs` · ACTIVE v95 |
| Edge `quote-update-status` | **DEPLOYED** · ACTIVE v51 |
| Edge `kanban-move` | **DEPLOYED** · ACTIVE v52 |
| Hostinger `app.bhfos.com` | **DEPLOYED** · live `build-info.commitSha` = `5cd7360aceb5492985cea6f3ff56253e5165bbea` |
| Migration re-apply | **Not performed** |

## Identity / automated post-checks

| Check | Result |
| --- | --- |
| `https://app.bhfos.com` HTTP | **200** |
| Live `/build-info.json` commitSha | **MATCH** `5cd7360…` |
| Live assets `index-ba868e63.js` / `index-b8748e12.css` | **MATCH** build |
| Lifecycle chunk `MlP1S2QuoteLifecyclePage-7c8de254.js` | **200** |
| ProposalList chunk | **200** |
| SPA deep route `/estimates/p1-lifecycle/*` | **200** (shell) |
| `health-probe` | **HEALTHY** |
| `verify:live-secrets` | **OK** (0 findings) |
| Pre-deploy Edge SHA-256 @ tip | **MATCH** packet (`B03DAD1A…` / `3D11DBD2…` / `EB00F3A8…`) |

## Rollback retained

| Item | Path |
| --- | --- |
| Pre-deploy live snapshot | `%LOCALAPPDATA%\BHFOS\production-rollbacks\pre-5cd7360-20260721-191322` (prior live tip `ef24707…`) |
| Deploy archive | `%LOCALAPPDATA%\BHFOS\production-archives\dist-deploy-20260721-191405-5cd7360.zip` |

## Operator money-path checks (require live session / test quote)

Pending Founder/operator controlled tests from Decision Packet § post-deploy:

5. Customer public approve → exactly one linked job  
6. Office break-glass approve → exactly one linked job  
7. Replay → same `job_id`  
8. Concurrent approve → one job  
9. Approve+job same transaction (fail address → quote stays issued)  
10. Paid status does not create job  
11. Deny paths (quote-update-status / Kanban accept / estimates create / client job insert with `quote_id`)  
12. Lifecycle UI shows created / linked / failure  
3. Auth session healthy (login smoke)  
14. No new runtime/DB error spike  

## Hard locks (still in force)

No Slice 4 · no Stripe · no invoices · no autonomous follow-up · no TIS · no G2.3 reopen · no migration re-apply · do not flip `auto_create_job_on_quote_acceptance=true`
