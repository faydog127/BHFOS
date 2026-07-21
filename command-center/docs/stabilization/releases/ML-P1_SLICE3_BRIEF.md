# ML-P1 Slice 3 — Scope and Design Brief

> A2 planning. **Does not authorize coding by itself.** Coding requires exact-head Founder authorization after this packet.
>
> Baseline: `ef2470715ddf90c34a77416183eb5b2421bd6373` · `app.bhfos.com`  
> Purpose: **Approved quote → exactly one canonical job**  
> Stop: Before field execution (S4), invoice (S5), Stripe (S5b), follow-up (S6)  
> Branch (coding, when authorized): `ml/p1-s3-quote-to-job`

Companion: [`ML-P1_SLICE3_ARCHITECTURE_FINDINGS.md`](./ML-P1_SLICE3_ARCHITECTURE_FINDINGS.md)

---

## 1. Scope

### In scope

- One canonical **server-side** job writer for accept/approve.
- Idempotent create: retries / double-submit / concurrent approve → **same job id**.
- Quote→job lineage (version pin, customer, address, pricing snapshot fields, actor, audit).
- Role matrix for approve→job (system path + break-glass).
- Controlled retirement of S2 “gate must stay off” belt.
- Neutralize accept/paid **trigger inserts** as independent creators.
- DB duplicate prevention for quote-linked jobs.
- Minimum office UI: linked job, create status, no duplicate action.
- Migrations + tests + evidence for A3 later (separate auth).

### Out of scope (hard lock)

- Field execution / scheduling product (S4)
- Invoice / payment / Stripe / refunds
- Autonomous follow-up
- TIS / G2.3 reopen
- Reopening Slice 2 lifecycle semantics (issue/revise/reject/expire remain)
- Restoring full WO-on-accept trigger body
- Estimates create path (R-S1-01 stays DENY)

---

## 2. Canonical job writer

**Name (proposed):** `public.ml_p1_s3_ensure_job_for_accepted_quote(p_quote_id uuid, p_correlation_id text, p_actor_role text, p_source text)`

| Rule | Decision |
| --- | --- |
| Kind | `SECURITY DEFINER` RPC / function, `search_path=public` |
| Caller | Only S2 approve paths after status write to `accepted` (same transaction): `ml_p1_s2_quote_lifecycle` (approve / break-glass) and `ml_p1_s2_quote_approve_public` |
| Not called by | Frontend direct insert; `quote-update-status`; paid trigger; manual `jobService.createJob` |
| Result | Returns `job_id`, `created boolean`, `idempotent boolean` |
| Client | Lifecycle service surfaces `jobCreated` / `jobId` from RPC JSON (no client insert) |

**Trigger policy (S3):** Rewrite `ensure_job_and_optional_draft_invoice_for_accepted_quote` so **accepted** and **paid** branches **never insert jobs**. Optional: call the canonical function only if invoked from a single internal helper — prefer **RPC-only** create to avoid dual entry. Paid remains deferred-event only.

**Edge policy:** `public-quote-approve` continues to prefer approve RPC (which now creates job). `quote-update-status` must **not** be an accept→job path: either reject transitions to `accepted`/`approved` for money quotes, or office Accept UI is switched to lifecycle RPC only (required coding item).

---

## 3. Allowed quote states for job create

| From | To (normalized) | Creates job? |
| --- | --- | --- |
| `issued` | `accepted` (incl. raw `approved`→normalize) | **Yes** — only via canonical writer |
| `accepted` | `accepted` (replay) | **No insert** — return existing job |
| `paid` | any | **No** |
| `draft` / `rejected` / `expired` / `revised` / superseded | — | **No** |
| Cancelled / void approval (future) | — | **No** (S3 does not add cancel product) |

Approval remains allowed only from `issued` (S2 transition assert unchanged).

---

## 4. Idempotency and concurrency

| Control | Design |
| --- | --- |
| DB unique | Keep `jobs_quote_id_unique`; writer uses `INSERT … ON CONFLICT (quote_id) DO UPDATE/DO NOTHING RETURNING` |
| Row lock | `SELECT … FROM quotes WHERE id = … FOR UPDATE` before create |
| Concurrent approve | Second transaction waits on quote lock; sees `accepted` + existing job → idempotent return |
| Replay | Already `accepted` with job → `{ idempotent: true, jobCreated: false, jobId }` |
| Correlation | `p_correlation_id` on audit event; not required as uniqueness key if `quote_id` unique holds |
| Version pin | Store `source_quote_version = quotes.quote_version` at create; conflict if caller supplies mismatched version |

---

## 5. Quote→job lineage

Job row (minimum fields; additive columns as needed):

| Field | Source |
| --- | --- |
| `tenant_id` | quote |
| `quote_id` | quote.id (FK) |
| `source_quote_version` | quote.quote_version at accept (**new column if absent**) |
| `lead_id` | quote.lead_id |
| `customer_*` / contact | quote customer fields (or lead join — prefer quote snapshot at accept) |
| `service_address` | quote / lead+property resolution (reuse S2 ensure_job address logic) |
| `total_amount` / tax / subtotal | quote approved/totals at accept |
| `quote_number` | quote.quote_number |
| `status` | `unscheduled` (or ratified create status — no field FSM expansion) |
| `payment_status` | `unpaid` |
| `work_order_number` | `next_work_order_number` (existing) |
| Actor / method | From approve path (`approval_method`, actor id) on **audit event**, not necessarily job columns |
| Timestamps | `created_at` / `updated_at` |

**Audit event (required):** `QuoteAccepted_JobEnsured` (or S3-named successor) with `job_id`, `quote_id`, `quote_version`, `correlation_id`, `source` (`customer_public` \| `office_break_glass` \| `lifecycle_approve`), `idempotent`.

Approved line items: S3 stores job totals + quote_id/version pin; **full line-item copy table is optional**. If omitted, document residual: invoice slice (S5) reads from pinned quote version. Prefer **no silent drift** — pin version is mandatory.

---

## 6. Authorization matrix (approve → job)

Job create is **not** a separate office button in the happy path. It is a **system effect of authorized approve**.

| Actor | Approve quote | Causes canonical job |
| --- | --- | --- |
| Customer (public token, unauthenticated) | Yes (`quote.approve_customer`) | Yes (system) |
| CSR / office / manager | No direct approve (S2) | — |
| Admin break-glass + reason | Yes | Yes (system) |
| Technician | Deny | Deny |
| Viewer | Deny | Deny |
| Partner | Deny | Deny |
| Direct `jobs` INSERT (client) | — | **Deny for quote-linked money path** (see residual) |
| `quote-update-status` → accepted | **Deny or no-op for money quotes** | Must not create |

Capability additions (proposed): none for “create job” as a user capability — keep create inside approve SECURITY DEFINER. Optional `job.ensure_from_quote` admin repair RPC (break-glass + reason) for recovery only.

---

## 7. S2 gate → S3 controlled path

| Step | Action |
| --- | --- |
| 1 | Ship canonical writer + lineage columns |
| 2 | Wire approve RPCs to call writer **in the same transaction** after accept update |
| 3 | Replace belt: remove `trg_ml_p1_s2_require_job_gate_off_on_accept` **or** change it to “accept allowed; job must be ensured by writer” (prefer remove belt once writer is mandatory in RPC) |
| 4 | Change `ml_p1_s2_job_gate_is_off` checks in approve RPCs: delete gate-off requirement; optionally replace with `ml_p1_s3_job_writer_ready()` always true after migrate |
| 5 | Neutral `ensure_job…` accepted/paid inserts → deferred events only (paid forever deferred in S3) |
| 6 | Keep `auto_create_job_on_quote_acceptance=false` as a **dead** flag or delete reads — do **not** re-enable trigger-based create |
| 7 | UI: Accept paths use lifecycle / public approve RPCs only |

**Forbidden:** Setting `auto_create_job_on_quote_acceptance=true` to “turn on S3.”

---

## 8. Database duplicate prevention

| Control | Action |
| --- | --- |
| `jobs_quote_id_unique` | Retain; writer depends on it |
| Partial unique (tenant, quote_id) | Retain; resolve any conflict with single writer upsert |
| Orphan jobs | Residual R-S3-01: document; optional RESTRICTIVE policy / DENY authenticated INSERT without `quote_id` in a follow-on if review requires — default S3 coding includes **assert quote_id NOT NULL** in canonical writer only |
| Version | Unique `(quote_id)` remains primary; version stored for lineage, not second job per version |

---

## 9. Failure and recovery

| Failure | Behavior |
| --- | --- |
| Job create fails inside approve txn | **Rollback** entire approve — quote stays `issued` |
| Partial write | Not allowed — single transaction |
| Retry after rollback | Safe — still `issued` → approve again |
| Replay after success | Idempotent — same `job_id` |
| Conflicting job (unique violation race) | Catch → select existing → return idempotent |
| Missing customer / service address | Fail closed with stable code `ML_P1_S3_ADDRESS_REQUIRED` or allow job with null address **only if** existing live ensure_job allowed null — prefer **fail closed** when dispatch-critical fields missing (align with office needs; default: require resolvable address or explicit `service_address` on quote) |
| Invalid / mismatched quote version | `ML_P1_S3_VERSION_MISMATCH` |
| Cancelled / rejected / expired / revised / superseded | Transition deny (existing) or writer deny if status ≠ accepted |
| Unauthorized | Existing S2 role deny codes |
| Approved without job (legacy drift) | Admin repair RPC (optional) or operator SQL under separate auth — not silent auto |

**Rollback of S3 migrate:** Forward-fix only. Feature rollback = redeploy prior frontend + disable writer call (quote approve without job) under new auth — DB columns additive.

---

## 10. Minimum office UI

On Slice 2 lifecycle / quote detail surfaces:

| Element | Behavior |
| --- | --- |
| Job link | Show `job_id` / WO number when present |
| Status | `Job created` \| `Idempotent (existing)` \| error code from last approve |
| Actions | No “Create job” if job exists; approve remains the create path |
| Failure | Surface RPC error; quote remains issued; retry approve |

No Kanban / schedule / tech assignment product in S3.

---

## 11. Migration requirements and ordering

| Order | Change |
| --- | --- |
| M1 | Additive: `jobs.source_quote_version` (and any snapshot columns decided in coding) |
| M2 | Canonical writer function + grants |
| M3 | Wire approve RPCs; remove gate-off asserts; remove/replace accept belt trigger |
| M4 | Neutralize ensure_job accepted/paid inserts (paid deferred) |
| M5 | Optional: deny/restrict non-canonical accept status writers |
| M6 | Record versions in `schema_migrations` (A3 apply later) |

**Apply:** Separate A3 Founder auth after coding merge + reviews. No apply in coding auth.

---

## 12. Test sentinels and adversarial cases

| ID | Case |
| --- | --- |
| T-01 | Approve issued → exactly one job; `jobCreated=true` |
| T-02 | Double-click / concurrent approve → one job; second idempotent |
| T-03 | Replay approve on accepted → same job id |
| T-04 | Paid status change → **zero** new jobs |
| T-05 | Reject/expire/revise → no job |
| T-06 | Technician/viewer/partner approve → deny |
| T-07 | Customer public approve → job; authenticated session on public path → deny (S2) |
| T-08 | Break-glass without reason → deny |
| T-09 | Missing address (if fail-closed) → approve rolls back |
| T-10 | Unique conflict race → idempotent return |
| T-11 | `quote-update-status` cannot create job / cannot accept money quote |
| T-12 | Source guards: no ungated INSERT in triggers; gate-off belt removed; flag not used to enable triggers |
| T-13 | R-S1-01 estimates INSERT DENY unchanged |
| T-14 | Audit event contains job_id + quote_version + correlation |

Unit + source-guard tests mandatory; live apply tests only after A3.

---

## 13. Evidence plan

| Phase | Evidence |
| --- | --- |
| Coding | Unit/source-guard suite green; Decision Packet reviews |
| Merge | Exact-head Founder auth |
| A3 apply | I2: writer present; belt gone; ensure_job no insert; unique intact; conflict counts unchanged |
| Deploy | Hostinger exact SHA; build-info match; SPA approve path smoke |

---

## 14. Risk-based review plan

| Review | Focus |
| --- | --- |
| Architecture | Single writer; no dual trigger/RPC create; paid deferred |
| Data | Uniqueness; lineage columns; txn boundaries |
| Security | SECURITY DEFINER grants; public approve; no client job insert |
| Financial control | Approve↔job atomicity; no silent orphan approve |
| Product | UI minimal; stop before field execution |
| Adversarial | Concurrent approve; status writer bypass; gate flip anti-pattern |

---

## 15. Residuals (explicit)

| ID | Residual | Disposition |
| --- | --- | --- |
| R-S3-01 | Manual/orphan `jobs` insert without `quote_id` | Document; optional harden in coding if low-risk |
| R-S3-02 | Full quote line-item snapshot table | Defer to S5 unless coding chooses cheap copy |
| R-S3-03 | WO-on-accept body restore | Deferred past S3 |
| R-S3-04 | Deployed Edge vs DB skew | A3/deploy checklist item |
