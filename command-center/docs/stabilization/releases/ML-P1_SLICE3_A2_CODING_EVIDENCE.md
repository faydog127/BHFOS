# ML-P1 Slice 3 — A2 Coding Evidence

> Coding authorized on branch `ml/p1-s3-quote-to-job` from main tip
> `ef2470715ddf90c34a77416183eb5b2421bd6373`.
>
> **Code freeze (lanes):** `dce50d19cffec132bc2eec12eaadfdbe665ded1c`
>
> **Does not authorize** migration apply, Hostinger deploy, Slice 4+, Stripe,
> invoices, autonomous follow-up, TIS, or G2.3 reopen.

## Delivered

| Item | Path / note |
| --- | --- |
| Migration | `command-center/supabase/migrations/20260721200000_ml_p1_s3_canonical_job_writer.sql` |
| SHA-256 @ code freeze | `B618AF707546150773784B71728BE75CE27C0A2B6D7814CF43EEFD41626579B1` |
| Canonical writer | `public.ml_p1_s3_ensure_job_for_accepted_quote(...)` |
| Lineage | `jobs.source_quote_version` + money re-pin on ensure |
| Trigger neutralize | `ensure_job…` accepted/paid → deferred events only (no job INSERT) |
| Belt retired | `DROP trg_ml_p1_s2_require_job_gate_off_on_accept` |
| Approve wire | lifecycle + public approve call writer in-txn; `ensure_job` repair |
| Edge | `quote-update-status` DENY; `public-quote-approve` WRITER_REQUIRED if RPC missing; kanban no insert/accept |
| UI | Lifecycle job status + ensure repair; ProposalList → lifecycle |
| Client | `jobCreated` / `jobId` surfaced from RPC |
| Tests | 36/36 unit/source-guard |
| Decision Packet | `docs/governance/decisions/ML-P1_SLICE3_PR84_DECISION_PACKET.md` |

## Explicit non-actions

- Did **not** set `auto_create_job_on_quote_acceptance=true`
- Did **not** apply migration to production
- Did **not** deploy frontend/edge
- Stop before field execution / invoice / Stripe / follow-up product

## Residual (documented)

| ID | Note |
| --- | --- |
| R-S3-01 | service_role / jobs UPDATE can still attach quote_id; authenticated INSERT with quote_id blocked |
| R-S3-02 | Full line-item copy table omitted; totals + version pin only |
| R-S3-04 | Office break-glass path does not call closeFollowUpTasks (public path does) |
| R-S3-05 | Live concurrency / clean-apply production-unverified (A3) |
