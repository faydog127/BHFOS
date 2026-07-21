# ML-P1 Slice 3 — A2 Coding Evidence

> Coding authorized on branch `ml/p1-s3-quote-to-job` from main tip
> `ef2470715ddf90c34a77416183eb5b2421bd6373`.
>
> **Does not authorize** migration apply, Hostinger deploy, Slice 4+, Stripe,
> invoices, autonomous follow-up, TIS, or G2.3 reopen.

## Delivered

| Item | Path / note |
| --- | --- |
| Migration | `command-center/supabase/migrations/20260721200000_ml_p1_s3_canonical_job_writer.sql` |
| Canonical writer | `public.ml_p1_s3_ensure_job_for_accepted_quote(...)` |
| Lineage | `jobs.source_quote_version` |
| Trigger neutralize | `ensure_job…` accepted/paid → deferred events only (no job INSERT) |
| Belt retired | `DROP trg_ml_p1_s2_require_job_gate_off_on_accept` |
| Approve wire | `ml_p1_s2_quote_lifecycle` + `ml_p1_s2_quote_approve_public` call writer in-txn |
| Edge | `quote-update-status` DENY accept/approve; `public-quote-approve` drops gate, passes `job_id`/`job_created` |
| UI | Lifecycle job status; ProposalList Accept → lifecycle route |
| Client | `jobCreated` / `jobId` surfaced from RPC |
| Tests | `tests/unit/ml-p1-s3-job-writer.test.mjs` (+ S2 suite updates) |

## Explicit non-actions

- Did **not** set `auto_create_job_on_quote_acceptance=true`
- Did **not** apply migration to production
- Did **not** deploy frontend
- Stop before field execution / invoice / Stripe / follow-up

## Residual (documented)

| ID | Note |
| --- | --- |
| R-S3-01 | Orphan / non-canonical client job inserts not fully blocked by RLS in this slice |
| R-S3-02 | Full line-item copy table omitted; invoice slice reads pinned quote version |
| R-S3-03 | Admin repair RPC for approved-without-job drift not shipped (optional) |
