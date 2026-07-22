# ML-P1 Slice 3 — Production Operator Validation Evidence

> Controlled synthetic test data only (`@example.invalid`, `is_test_data=true`).  
> Live tip `5cd7360aceb5492985cea6f3ff56253e5165bbea`. Cleanup completed for run data.

## Disposition

# **SLICE3_PRODUCTION_VALIDATION_FAIL**

## Exact failing check

**3. Office approval creates exactly one job**

`ml_p1_s2_quote_lifecycle` (`issue` / `approve` / related audit path) fails with:

`column "actor_id" is of type uuid but expression is of type text`

No office-created job. Public Edge approve path still creates exactly one job.

## Production impact

- **Office / break-glass lifecycle approve is non-functional** in production (cannot accept→job from CRM lifecycle RPC).
- **Lifecycle `issue` RPC** hits the same defect (audit `events.actor_id` cast).
- **Customer public approve** (`public-quote-approve` → `ml_p1_s2_quote_approve_public`) **works**: one job, lineage OK, concurrent collapse to one job observed.
- Deny paths (`quote-update-status`, `kanban-move`, role/anon/invalid token) **PASS**.
- Paid status does **not** create a job (**PASS**).

## Rollback recommendation

- **Do not reverse the S3 migration** (writer/public path are serving production correctly).
- **Do not roll back Edge/Hostinger** for this defect (public path is the working surface).
- **Forward-fix:** apply a bounded SQL repair so lifecycle RPC audit inserts cast `actor_id` to `uuid` (or write uuid-typed value) matching `events.actor_id`; re-run office checks 3–4 and 10.
- Optional interim: keep using public-token approve only until repair; office break-glass remains blocked.

## Check matrix (run `s3val-20260722001018-dec81669`)

| # | Check | Result |
| --- | --- | --- |
| 1 | Public approve → one job | **PASS** |
| 2 | Public replay → same job | **FAIL*** (HTTP 409; same `job_id` retained) |
| 3 | Office approve → one job | **FAIL** (`actor_id` uuid/text) |
| 4 | Office replay → same job | **FAIL** (blocked by #3) |
| 5 | Concurrent → one job | **PASS** |
| 6 | Unauthorized denies | **PASS** |
| 7 | `quote-update-status` no job | **PASS** |
| 8 | `kanban-move` no job | **PASS** |
| 9 | Paid → no job | **PASS** |
| 10 | Lifecycle UI states | **FAIL** (office path blocked) |
| 11 | Lineage match | **PASS** |
| 12 | No new runtime/DB errors | **FAIL** (lifecycle RPC error above) |

\*Replay still linked the same job; Edge returned 409 instead of 200/idempotent JSON.

## Cleanup

All synthetic leads/quotes/jobs/ephemeral auth users for the run were deleted. No production customer data altered.
