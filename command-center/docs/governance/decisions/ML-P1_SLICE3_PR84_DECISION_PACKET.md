# Decision Packet — ML-P1 Slice 3 A2 Review (PR #84)

> **One consolidated founder-facing decision surface.** Agent-prepared.
> No credentials, secrets, customer data, or pasted logs.
>
> All review lanes evaluated the same frozen head below.
> **Do not merge, deploy, apply S3 migrations, or begin Slice 4 under this packet alone.**

---

## Disposition

# **SLICE3_READY_FOR_MERGE_AUTH**

Merge authorization only. **A3 apply / Hostinger deploy / Slice 4 remain separately locked.**

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S3` |
| Governance | v2.2 + Reduced AI Development Assurance Pilot |
| Risk tier | **Tier 3** (money-state) |
| PR | [#84](https://github.com/faydog127/BHFOS/pull/84) |
| Branch / worktree | `ml/p1-s3-quote-to-job` / `F:\Dev\BHFOS-ml-p1-s3` |
| Coding auth base | `ef2470715ddf90c34a77416183eb5b2421bd6373` |
| Prior freeze (remediated) | `7fde2f4f2811b9074a1be2816b2b7ad3d4889656` |
| **Frozen PR head** | `dce50d19cffec132bc2eec12eaadfdbe665ded1c` |

## Operational problem

Slice 3 must deliver **approved/accepted quote → exactly one canonical job** with idempotency, lineage, authorization, trigger neutralization, and minimum office UI status — stopping before field execution.

## What landed at freeze (SOURCE / unit EXECUTED)

- Migration `20260721200000_ml_p1_s3_canonical_job_writer.sql` — **not applied to prod**
- Canonical writer `ml_p1_s3_ensure_job_for_accepted_quote` + `jobs.source_quote_version`
- Approve RPCs call writer in-txn; S2 gate belt dropped; accept/paid triggers deferred-only
- Fail-closed `public-quote-approve` (no approve-without-job fallback)
- `quote-update-status` + kanban accept/create DENY; jobs INSERT RLS `quote_id IS NULL`
- Lifecycle UI job status + `ensure_job` repair; ProposalList → lifecycle
- Evidence Manifest + Pilot M1–M5 + unit/source-guard suites

## Migration checksum (frozen tree)

| File | SHA-256 |
| --- | --- |
| `command-center/supabase/migrations/20260721200000_ml_p1_s3_canonical_job_writer.sql` | `B618AF707546150773784B71728BE75CE27C0A2B6D7814CF43EEFD41626579B1` |

## Hard stops held

No merge without Founder auth on this packet · no deploy · no production S3 migration apply (needs **A3**) · no Slice 4 · no Stripe · no invoice product · no autonomous follow-up product · no TIS / G2.3 reopen · `auto_create_job_on_quote_acceptance` **not** set true

## Evidence (executed vs source-only vs production-unverified)

| Claim | Level |
| --- | --- |
| Unit + source guards (36/36) including WRITER_REQUIRED, kanban DENY, tenant mismatch raises, writer wiring | **EXECUTED** (local Node) |
| Same-txn approve+job; `FOR UPDATE`; unique `quote_id`; trigger never inserts; conflict recovery tenant re-check | **SOURCE-ONLY** |
| Clean-apply on production Supabase `wwyxohjnyqnegzbxtuxs` | **PRODUCTION-UNVERIFIED** (A3) |
| Live concurrent dual-approve race / live public-token → job | **PRODUCTION-UNVERIFIED** |
| Edge function runtime deploy of remediated `public-quote-approve` / `kanban-move` / `quote-update-status` | **PRODUCTION-UNVERIFIED** |

**Rollback (pre-apply):** close/revert PR. **Post-A3:** forward-fix restore prior function bodies/policies under new Founder auth; never flip auto-job flag to re-enable trigger create.

## Reconciled reviews @ `dce50d19cffec132bc2eec12eaadfdbe665ded1c`

| Role | Verdict |
| --- | --- |
| Product | **APPROVE** (accept→one job; stop before field; sent/viewed office path restored via lifecycle) |
| Data | **APPROVE** (additive column; unique retained; clean-apply deferred to A3) |
| Security | **APPROVE** (prior highs/mediums closed at freeze; residual R-S3-01 service_role / UPDATE attach documented) |
| Financial Control | **APPROVE** (money re-pin on ensure; no invoice/Stripe; fail-closed address) |
| Architecture | **APPROVE** (single writer; triggers neutralized; flag flip ignored) |
| UX/Field | **APPROVE** (job status + ensure repair; no field scheduling expansion) |
| Independent Adversarial Test | **PASS** after remediation (prior FAIL items closed; residuals below) |

### Review cycle notes

**At prior freeze `7fde2f4…` — remediation required:**

1. Public approve fallback could approve without job after gate removal (**HIGH**) — **CLOSED** (`ML_P1_S3_WRITER_REQUIRED`)
2. Kanban `getOrCreateJobForQuote` insert + status accept (**HIGH**) — **CLOSED**
3. sent/viewed Accept → lifecycle dead-end (**HIGH**) — **CLOSED** (approve from sent/viewed)
4. Writer idempotent trust without tenant/money pin (**MEDIUM**) — **CLOSED** (+ conflict-path tenant re-check)
5. Ensure-job UI unreachable / stale state — **CLOSED**

### Non-blocking residuals

| ID | Note |
| --- | --- |
| R-S3-01 | `service_role` can still insert/update jobs; authenticated UPDATE can still set `quote_id` (INSERT blocked when `quote_id` set) |
| R-S3-02 | No full line-item copy table; totals + `source_quote_version` pin only |
| R-S3-04 | Office break-glass path does not call `closeFollowUpTasks` (public path does) |
| R-S3-05 | Live DB concurrency / clean-apply not executed at A2 |

## Pilot M1–M5

See `command-center/docs/stabilization/releases/ML-P1_SLICE3_PILOT_M1_M5.md` — all **PASS (source)** with production-unverified apply/concurrency.

## Recommendation

**Authorize merge of PR #84 at `dce50d19cffec132bc2eec12eaadfdbe665ded1c`.**

Do **not** apply migration or deploy under this packet. Next Founder line (separate): **A3** production apply + edge deploy + post-apply verification, then only later Slice 4 field execution.

## Exact authorization requested

> **Yes — merge auth only** for PR #84 at exact head `dce50d19cffec132bc2eec12eaadfdbe665ded1c`.

Optional follow-on (yes/no; not authorized by this packet):

> Authorize ML-P1 Slice 3 **A3** production migration apply + function deploy + I2 post-apply verification against `wwyxohjnyqnegzbxtuxs` / `app.bhfos.com`. Still no Slice 4 / Stripe / invoice / follow-up product / TIS / G2.3.
