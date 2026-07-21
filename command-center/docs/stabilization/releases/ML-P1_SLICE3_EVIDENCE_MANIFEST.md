# Evidence Manifest — ML-P1 Slice 3 A2 (canonical quote→job)

> Pilot template. Builder cannot self-certify production apply or USABLE without
> Founder/independent evidence.

| Field | Value |
| --- | --- |
| Authorized slice / scope | **ML-P1-S3 A2 coding + review remediation** — canonical writer; approve+job same txn; idempotency; lineage pin; trigger neutralize; alternate-path DENY; minimum office UI |
| Coding auth base SHA | `ef2470715ddf90c34a77416183eb5b2421bd6373` (main) |
| Branch / worktree | `ml/p1-s3-quote-to-job` / `F:\Dev\BHFOS-ml-p1-s3` |
| PR | [#84](https://github.com/faydog127/BHFOS/pull/84) |
| **Frozen review head** | Code: `dce50d19cffec132bc2eec12eaadfdbe665ded1c` · Tip: `ae18a05aa8f9d7562d6e5191615296b1e4fd13bf` |
| Prior freeze (remediated) | `7fde2f4f2811b9074a1be2816b2b7ad3d4889656` |
| Migration file | `command-center/supabase/migrations/20260721200000_ml_p1_s3_canonical_job_writer.sql` |
| Migration SHA-256 | `B618AF707546150773784B71728BE75CE27C0A2B6D7814CF43EEFD41626579B1` |
| Data objects changed (proposed, not applied) | `jobs.source_quote_version`; `ml_p1_s3_ensure_job_for_accepted_quote`; rewired `ml_p1_s2_quote_lifecycle` / `ml_p1_s2_quote_approve_public`; neutralized `ensure_job…` + WO trigger; dropped gate belt; jobs INSERT RLS `quote_id IS NULL` |
| Tests executed | `node --test tests/unit/ml-p1-s2-lifecycle.test.mjs tests/unit/ml-p1-s3-job-writer.test.mjs` — **36/36 pass** |
| Tests skipped + reason | Live prod apply / edge deploy / DB concurrency against production — **not authorized** (A3) |
| Runtime environments tested | Local Node unit + migration/edge source guards |
| Claims proven by **execution** | Client surfaces `jobCreated`/`jobId`; transition helpers for sent/viewed/ensure_job; ADDRESS_REQUIRED mapping; source guards (no gate, no approve fallback, no kanban job insert, writer wiring, tenant mismatch raise, RLS quote_id null) |
| Claims supported by **source inspection only** | Same-txn approve+job; `FOR UPDATE` + `jobs_quote_id_unique`; trigger deferred-only; flag flip ignored by neutralized ensure_job; financial re-pin on idempotent ensure |
| Claims **production-unverified** | Clean-apply on `wwyxohjnyqnegzbxtuxs`; live concurrent approve race; live public-token approve→job; Hostinger edge deploy of functions |
| Known residuals | R-S3-02 full line-item copy table omitted (totals + quote_id/version pin); R-S3-03 service_role can still insert jobs; invoice/Stripe/field still out of scope |
| Rollback method | Before apply: revert/close PR. After A3 apply: forward-fix — restore prior function bodies/policies under new Founder auth; do not flip `auto_create_job_on_quote_acceptance=true` |
| Required reviewers | Product · Data · Security · Financial Control · Architecture · UX/Field · Independent Adversarial Test |

**Hard stop:** no merge without exact-head Founder auth; no deploy; no production S3 migration apply without A3; no Slice 4 / Stripe / follow-up / invoice / TIS / G2.3.
