# Decision Packet — ML-P1 Slice 3 Production Migration A3 (pre-apply)

> Reduced AI Development Assurance Pilot. Agent-prepared from approved **I2
> read-only** catalog/health ops + main source. **No migration apply. No deploy.**
>
> No credentials, secrets, customer data, or financial row dumps.

---

## Disposition

# **SAFE_TO_AUTHORIZE_APPLY** → **APPLIED + POST_APPLY_VERIFICATION_PASS**

Pre-apply disposition was **SAFE_TO_AUTHORIZE_APPLY**. Founder applied; I2 post-apply
evidence: [`ML-P1_SLICE3_A3_POST_APPLY_VERIFICATION.md`](../../stabilization/releases/ML-P1_SLICE3_A3_POST_APPLY_VERIFICATION.md).

Does **not** authorize Hostinger frontend deploy, Edge Function deploy, Slice 4,
Stripe, invoices, autonomous follow-up, TIS, or G2.3 reopen.

---

## Release identity

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S3-A3-APPLY` |
| Project | `wwyxohjnyqnegzbxtuxs` |
| Main tip (merged source) | `5cd7360aceb5492985cea6f3ff56253e5165bbea` |
| Code freeze ancestor (reviewed) | `dce50d19cffec132bc2eec12eaadfdbe665ded1c` |
| Migration path | `command-center/supabase/migrations/20260721200000_ml_p1_s3_canonical_job_writer.sql` |
| Git blob OID | `40eaf14333f3074d14cc43313ef1cfda166b2b33` |
| **Authoritative SHA-256 (LF git blob)** | `50E4362A34ED408C42C86A45DFACA66611A0903703765681C2CC42C4B3F7DD3D` |
| Prior reported checksum | `B618AF707546150773784B71728BE75CE27C0A2B6D7814CF43EEFD41626579B1` |
| Checksum reconciliation | Prior value matches a **CRLF working-tree checkout** (29332 bytes). Independent hash of `git cat-file blob` on `origin/main` is the LF blob above (28432 bytes, no CR). **Use the LF blob SHA-256 for Founder A3 auth and apply artifact verification.** |

## Branch-protection admin bypass (process exception — non-product)

| Fact | Evidence |
| --- | --- |
| Authorized tip matched | PR #84 merged at `c6471ec59d1ae570295865b8ec5108eb1f00198c` |
| Code freeze ancestor matched | `dce50d19…` ⊆ merge commit `5cd7360…` |
| Failing required check | `ledger_lock` — PowerShell `Receive-Job -AutoRemoveJob` harness error in billing concurrency script (unrelated to S3 quote→job) |
| lint / build | Pass |
| Conclusion | **Admin bypass was process-only under Founder merge auth.** **No** conclusion that the flaky `ledger_lock` harness is permanently acceptable; track separate CI remediation. |

---

## I2 live posture (read-only) — `wwyxohjnyqnegzbxtuxs`

Approved paths only: adapter `--self-test`; `project-health`; catalog ops (no agent SQL; no `execute-sql`; no row dumps).

| Check | Result |
| --- | --- |
| Adapter self-test | **PASS** |
| `project-health` (db/auth/rest) | **ACTIVE_HEALTHY** |
| S2 migrations present | **YES** — `20260721160000_ml_p1_s2_quote_lifecycle_rs102`, `20260721170000_ml_p1_s2_lifecycle_server_authz` |
| S3 migration present | **NO** — `20260721200000` absent from `schema_migrations` |
| `ml_p1_s3_ensure_job_for_accepted_quote` | **ABSENT** (empty signature body) — expected pre-apply |
| S2 RPCs present | **YES** — `ml_p1_s2_quote_lifecycle`, `ml_p1_s2_quote_approve_public` (SECURITY DEFINER) |
| Gate helpers / belt function | **YES** — `ml_p1_s2_job_gate_is_off`, `ml_p1_s2_trg_require_job_gate_off_on_accept` |
| Quotes triggers (live) | `trg_quotes_ensure_job_and_invoice` → `ensure_job…`; `trg_ml_p1_s2_require_job_gate_off_on_accept`; `on_quote_accepted_emit_wo` → `trg_emit_wo_on_quote_accept` |
| `jobs.source_quote_version` | **ABSENT** — additive column safe |
| `jobs_quote_id_unique` | **PRESENT** — `UNIQUE (quote_id) WHERE quote_id IS NOT NULL` |
| Additional quote uniqueness indexes | Also present: `idx_jobs_unique_quote`, `jobs_tenant_quote_unique`, `idx_jobs_one_active_per_quote` (tenant+quote partials) |
| Jobs INSERT RLS (live, pre-apply) | Tenant check only — **not yet** `quote_id IS NULL` (S3 migration tightens) |
| Quotes RLS | Draft-only INSERT/UPDATE policies intact (S2) |
| R-S1-02 aggregate | `conflict_group_count=0`, `conflicting_row_count=0` |
| `auto_create_job_on_quote_acceptance` live value | **Not readable via standing I2 catalog ops** (no `global_config` aggregate). Treated as **SOURCE + prior S2 A3 posture** (gate intended false); **must re-verify in post-apply I2** |

### Row conflict / uniqueness (apply safety)

| Concern | Assessment |
| --- | --- |
| New UNIQUE that could fail apply | **None** — migration relies on existing `jobs_quote_id_unique` |
| New NOT NULL | **None** — `source_quote_version` nullable |
| Duplicate `quote_id` jobs | Structurally blocked by live unique index; no separate aggregate op required for apply gate |
| Lineage column backfill | Additive only; existing jobs remain valid with NULL version until ensure re-pins |

---

## Source verification (main `5cd7360…`) — migration intent

| Requirement | Source evidence |
| --- | --- |
| Adds writer + lineage column | `ml_p1_s3_ensure_job_for_accepted_quote`; `ADD COLUMN IF NOT EXISTS source_quote_version` |
| Uniqueness / idempotency | `FOR UPDATE` on quote; `ON CONFLICT (quote_id) WHERE quote_id IS NOT NULL`; tenant re-check on conflict recovery |
| Trigger neutralize | `ensure_job…` accepted/paid → deferred events only (no `INSERT INTO jobs`); WO trigger deferred |
| Gate belt retirement | `DROP TRIGGER trg_ml_p1_s2_require_job_gate_off_on_accept`; belt function no-op |
| Does not enable auto-job flag | No `global_config` UPDATE enabling `auto_create_job_on_quote_acceptance` |
| Approve + job same txn | Writer called inside approve RPCs before function return |
| Paid cannot create job | Paid branch deferred-only |
| Fail-closed | `ML_P1_S3_ADDRESS_REQUIRED`, `ML_P1_S3_VERSION_MISMATCH`, `ML_P1_S3_TENANT_DENY`, status deny |
| Jobs INSERT hardening | Authenticated INSERT `WITH CHECK (… AND quote_id IS NULL)` |

### Alternate writers (source — deploy-dependent for edge)

| Path | Post-merge source posture | Apply vs deploy |
| --- | --- | --- |
| Canonical writer | Only authorized quote→job create | **DB apply** |
| `quote-update-status` | DENY accept/approve | Needs **Edge deploy** |
| `public-quote-approve` | RPC-only; `ML_P1_S3_WRITER_REQUIRED` if RPC missing | Needs **Edge deploy** after/with DB |
| `kanban-move` | No job insert; accept status DENY | Needs **Edge deploy** |
| Frontend ProposalList / lifecycle | Routes to lifecycle RPC; surfaces jobId | Needs **Hostinger frontend deploy** |
| `jobService.createJob` | No `quote_id` (non-quote path) | Residual R-S3-01 for service_role |
| Estimates create | R-S1-01 DENY (unchanged by S3 SQL) | Intact |

**Apply-order note:** After DB apply, live public approve works only when Edge still calls the RPC (already preferred). Pre-deploy Edge with fail-closed WRITER_REQUIRED is safe if DB not applied; **DB applied + old Edge fallback** was closed in merged source — deploy Edge before or immediately with enabling public approve traffic.

---

## Rollback / recovery

| Phase | Procedure |
| --- | --- |
| Before apply | Do not run SQL; close auth line |
| After apply (forward-fix) | New Founder auth to restore prior function bodies for `ensure_job…`, approve RPCs, belt trigger, and jobs INSERT policy from S2 migrations; do **not** set `auto_create_job_on_quote_acceptance=true` |
| Partial apply failure | Re-run only if transaction aborted cleanly; if mid-file statements committed outside a single txn window, stop and inventory via I2 catalog before retry |
| Approved-without-job drift | Admin `ensure_job` lifecycle action (break-glass + reason) after apply |

---

## Deploy dependencies (explicitly **out of** this apply auth)

1. Supabase Edge: `public-quote-approve`, `quote-update-status`, `kanban-move`
2. Hostinger frontend: lifecycle service/UI + ProposalList Accept routing
3. Not authorized here

---

## Required post-apply I2 verification (before declaring USABLE)

1. `catalog_migration_history` includes `20260721200000` / `ml_p1_s3_canonical_job_writer`
2. `catalog_function_signature` — `ml_p1_s3_ensure_job_for_accepted_quote` present (SECURITY DEFINER)
3. `catalog_columns` — `jobs.source_quote_version` present
4. `catalog_triggers` — `trg_ml_p1_s2_require_job_gate_off_on_accept` **absent** (dropped)
5. `catalog_policies` — jobs INSERT `with_check` includes `quote_id IS NULL`
6. `catalog_quotes_s2_active_unique_conflict_counts` still `0/0`
7. Confirm `auto_create_job_on_quote_acceptance` remains false (Dashboard/config read under Founder or future bounded op — do not flip true)
8. Smoke (non-prod or Founder-approved): public/break-glass approve → one job; replay same `job_id`; paid path creates no job

---

## Exact Founder A3 authorization line (copy/paste)

> Authorize A3 production **migration apply only** of  
> `command-center/supabase/migrations/20260721200000_ml_p1_s3_canonical_job_writer.sql`  
> (SHA-256 `50E4362A34ED408C42C86A45DFACA66611A0903703765681C2CC42C4B3F7DD3D`, git blob `40eaf14333f3074d14cc43313ef1cfda166b2b33`)  
> to Supabase project `wwyxohjnyqnegzbxtuxs` from main `5cd7360aceb5492985cea6f3ff56253e5165bbea`.  
> Require I2 post-apply verification per `ML-P1_SLICE3_A3_APPLY_DECISION_PACKET.md`.  
> Does **not** authorize Hostinger deploy, Edge deploy, Slice 4, Stripe, invoices, autonomous follow-up, TIS, or G2.3 reopen.

---

## Pilot note

| Metric | Value |
| --- | --- |
| M1 Founder interruptions for live SQL | **0** (I2 catalog used) |
| Customer/financial row data returned | **0** |
