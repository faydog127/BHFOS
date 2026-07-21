# ML-P1 Slice 2 — Data Review

| Field | Value |
| --- | --- |
| Slice | ML-P1-S2 |
| Migration | `command-center/supabase/migrations/20260721160000_ml_p1_s2_quote_lifecycle_rs102.sql` |
| Reviewer | _(Data — fill)_ |
| Verdict | **PENDING** |

## Schema / constraints

- `quotes.idempotency_key` + UNIQUE `(tenant_id, idempotency_key)` where set (**R-S1-02**).
- Versioning: `quote_version`, `supersedes_quote_id`.
- Approval audit columns: `approved_amount`, `approval_method`, `approved_by_actor_id`, `issued_at`, `expired_at`.
- Active lead UNIQUE expanded to include `issued`.
- Job auto-create gated by `global_config.auto_create_job_on_quote_acceptance` default `false`.

## Risks

- Existing leads with both `draft` and legacy `sent`/`viewed` may already stress active UNIQUE — verify before A3.
- Do **not** apply to production without separate Founder A3 line.

## R-S1-01

Unchanged. Not reopened.
