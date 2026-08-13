# Decision Packet — ML-P1 Slice 3 Coding Authorization

> **One consolidated founder-facing decision surface.** Agent-prepared under A2 planning.
> No credentials, secrets, or customer data.
>
> **Does not write product code. Does not apply migrations. Does not deploy.**
>
> Production baseline: `ef2470715ddf90c34a77416183eb5b2421bd6373`  
> Domain: `app.bhfos.com`  
> Slice 2: merged, migrated, deployed, verified

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S3-PLANNING` |
| Slice | **S3 — Approved quote → exactly one canonical job** |
| Risk tier | **Tier 3** (money_state path control) |
| Planning branch | `ml/p1-s3-planning` |
| Coding branch (when authorized) | `ml/p1-s3-quote-to-job` |
| Brief | [`ML-P1_SLICE3_BRIEF.md`](../../stabilization/releases/ML-P1_SLICE3_BRIEF.md) |
| Findings | [`ML-P1_SLICE3_ARCHITECTURE_FINDINGS.md`](../../stabilization/releases/ML-P1_SLICE3_ARCHITECTURE_FINDINGS.md) |
| Parent contract | [`ML-P1_MONEY_STATE_DESIGN_CONTRACT.md`](../../stabilization/releases/ML-P1_MONEY_STATE_DESIGN_CONTRACT.md) |

---

## Disposition

**SLICE3_READY_TO_AUTHORIZE_CODING**

Planning is complete enough to authorize bounded coding. Locked recommendations close the dual-writer and gate-flip hazards without requiring further Founder architecture choices before coding starts.

---

## Locked design decisions (coding must honor)

1. Canonical writer is a **SECURITY DEFINER** server function invoked from approve RPCs in the **same transaction** as accept.
2. **Do not** enable S3 by setting `auto_create_job_on_quote_acceptance=true`.
3. Remove/replace the S2 “gate must be off to accept” belt as part of wiring the writer.
4. Neutralize trigger inserts on **accepted** and **paid**; paid never creates jobs in S3.
5. Office Accept must not rely on `quote-update-status` as a job creator.
6. Stop before field execution, invoice, Stripe, follow-up, TIS, G2.3.
7. Do not reopen Slice 2 issue/revise/reject/expire semantics or R-S1-01.

---

## Review plan (before merge of coding PR)

Architecture · Data · Security · Financial control · Product · Adversarial (see Brief §14).

---

## Exact Founder coding authorization line

> Authorize A2 coding of ML-P1 Slice 3 only on branch `ml/p1-s3-quote-to-job` from main `ef2470715ddf90c34a77416183eb5b2421bd6373`, implementing the canonical server-side job writer per `ML-P1_SLICE3_BRIEF.md`: approved/accepted quote → exactly one job with idempotency, lineage, authz, trigger neutralization, and minimum office UI status; stop before field execution. Does not authorize migration apply, deploy, Slice 4+, Stripe, invoices, autonomous follow-up, TIS, or G2.3 reopen.

---

## Explicit non-authorization

| Action | Status |
| --- | --- |
| Product coding | **Requires** the line above |
| Migration apply (A3) | Not authorized |
| Production deploy | Not authorized |
| Stripe / invoices / follow-up / TIS / G2.3 | Not authorized |
| Slice 2 reopen | Not authorized |
