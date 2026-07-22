# ML-P1 S4 — Data Review

| Field | Value |
| --- | --- |
| Verdict | **APPROVE** (SOURCE-ONLY) |
| Evidence class | SOURCE-ONLY — migrations not applied to production |

## Findings

- Additive status legalization `NOT VALID`.
- Tables: `job_time_events`, `change_orders`, `change_order_items`, `change_order_events`, `job_execution_mutations`, `job_make_safe_events`.
- Partial unique: one `pending_approval` CO per job; mutation idempotency indexes.
- S3 ensure_job re-pinned with writer context + `quote_number::text` preserved.
- RLS select-only for authenticated on new tables; writes via SECURITY DEFINER RPCs.

## PRODUCTION-UNVERIFIED

- Clean apply / constraint validation on `wwyxohjnyqnegzbxtuxs`.
