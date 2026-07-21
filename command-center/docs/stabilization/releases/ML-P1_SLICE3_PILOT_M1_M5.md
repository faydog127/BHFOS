# ML-P1 Slice 3 — Pilot M1–M5 (A2 review evidence)

Frozen against Decision Packet head (see packet). **No production execution.**

| Gate | Intent | Status @ A2 | Evidence class |
| --- | --- | --- | --- |
| **M1** | Canonical writer exists; alternate quote→job writers denied in source | **PASS (source)** | Migration defines `ml_p1_s3_ensure_job_for_accepted_quote`; `quote-update-status` DENY; `public-quote-approve` WRITER_REQUIRED if RPC missing; `kanban-move` no insert / no accept status write; jobs RLS `quote_id IS NULL` for authenticated INSERT |
| **M2** | Approve + job same transaction; fail rolls back | **PASS (source)** | Writer called inside approve RPCs before COMMIT; ADDRESS/VERSION/TENANT raises abort PL/pgSQL function |
| **M3** | Idempotency / uniqueness | **PASS (source + unit)** | `jobs_quote_id_unique` + `FOR UPDATE` on quote; unit replay surfaces same `jobId`; live concurrency **NOT PROVEN** |
| **M4** | Lineage + address fail-closed | **PASS (source)** | Pins `source_quote_version`, `total_amount` from approved snapshot; `ML_P1_S3_ADDRESS_REQUIRED`; residual: no line-item copy table (R-S3-02) |
| **M5** | Scope containment | **PASS (source)** | No invoice/Stripe/field scheduling product; UI status only; WO trigger remains deferred |

## Explicit production-unverified

- Migration not applied to production Supabase.
- Edge functions not redeployed to Hostinger/Supabase functions runtime.
- No live two-session concurrent approve test executed.
