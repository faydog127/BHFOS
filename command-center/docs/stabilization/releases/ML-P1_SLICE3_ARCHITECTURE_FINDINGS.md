# ML-P1 Slice 3 — Source and Live Architecture Findings

> A2 planning evidence. **No product code. No migrations. No deploy.**
>
> Baseline: `main` / production `ef2470715ddf90c34a77416183eb5b2421bd6373`  
> Domain: `app.bhfos.com`  
> Slice 2: merged, migrated (A3), deployed, post-apply verified

---

## 1. Verified production posture (post-S2)

| Fact | Evidence |
| --- | --- |
| S2 migrations applied | `schema_migrations`: `20260721160000`, `20260721170000` |
| Job gate default | `auto_create_job_on_quote_acceptance=false` (applied with S2) |
| Accept belt | `trg_ml_p1_s2_require_job_gate_off_on_accept` present — blocks `accepted` unless gate is off |
| Approve RPCs | `ml_p1_s2_quote_lifecycle`, `ml_p1_s2_quote_approve_public` present; return `jobCreated=false` |
| Gate helper | `ml_p1_s2_job_gate_is_off` present |
| Ensure-job trigger | `trg_quotes_ensure_job_and_invoice` still wired to `ensure_job_and_optional_draft_invoice_for_accepted_quote` — body gated off in applied S2 |
| WO emit | `on_quote_accepted_emit_wo` → neutralized deferred event only |
| Frontend | Deployed SPA wires S2 RPCs; S2 lifecycle chunk present |

**Implication:** Live accept→job auto-create is **deferred**, not deleted. S3 cannot “flip the flag on” without redesigning the S2 belt that **requires the gate to stay off** for accept to succeed.

---

## 2. Inventory — every path that can create a job

| ID | Path | Mechanism | Live / source posture |
| --- | --- | --- | --- |
| J-01 | DB trigger `trg_quotes_ensure_job_and_invoice` | `ensure_job…` on quote status → `accepted` | Wired; **gated off** (S2) — deferred event |
| J-02 | Same function on status → `paid` | Insert/upsert job | Wired; **gated off** (S2) — deferred event |
| J-03 | `trg_emit_wo_on_quote_accept` | Historical WO/job body | **Neutralized** (deferred event only) |
| J-04 | `ml_p1_s2_quote_lifecycle` approve | SECURITY DEFINER RPC | **No job insert**; requires gate off |
| J-05 | `ml_p1_s2_quote_approve_public` | Public token RPC | **No job insert**; requires gate off |
| J-06 | Edge `public-quote-approve` | Prefers RPC; fail-closed | Source: no job insert |
| J-07 | Edge `quote-update-status` | Updates quote status only | Indirect: would hit J-01 if accept allowed |
| J-08 | Frontend `jobService.createJob` | Client `.from('jobs').insert` | Capability exists; **no in-app callers** found; often **no `quote_id`** |
| J-09 | Estimates writers | — | **Do not create jobs** (R-S1-01 INSERT DENY on estimates) |
| J-10 | Inspection handoff | Links / quotes | **No job insert** |
| J-11 | Stripe / pay edges | — | **No job insert** |
| J-12 | Test/scripts | Smoke / matrix fixtures | Non-product |

---

## 3. Uniqueness and constraints (jobs)

| Constraint | Purpose |
| --- | --- |
| `jobs_quote_id_unique` on `(quote_id) WHERE quote_id IS NOT NULL` | One job per quote when `quote_id` set |
| `jobs_tenant_quote_unique` on `(tenant_id, quote_id) WHERE quote_id IS NOT NULL` | Tenant-scoped overlap |
| `jobs_tenant_work_order_number_uidx` | WO number uniqueness |

**Gap:** Jobs **without** `quote_id` bypass quote uniqueness → orphan jobs possible via J-08.

---

## 4. S2 authz patterns to extend (not reopen)

- Server role from `app_user_roles` + JWT tenant only.
- Capabilities: customer public approve; office/manager/admin issue/revise/reject/expire; admin break-glass approve + reason.
- Approve only from `issued`.
- Draft-only quotes RLS; lifecycle via SECURITY DEFINER RPCs.
- Idempotent approve replay when already accepted.

---

## 5. Critical S3 design pressures

1. **Belt vs enablement:** Removing “gate must be off” and enabling create must be one coordinated design — not a config flip.
2. **Dual entry:** `quote-update-status` Accept vs S2 RPCs must converge on one writer.
3. **Paid must not create:** Money-State is approve→job; paid→job is a second creation moment and must stay deferred in S3.
4. **Same-transaction prefer:** Approve + job create in one DB transaction prevents “approved without job.”
5. **Lineage incomplete:** Jobs store `quote_id` / amounts today; Money-State requires `source_quote_version` (or equivalent) pin.
6. **Stop before field execution:** S3 creates the canonical job row + audit; scheduling/tech completion is S4.
7. **WO restore:** Out of S3 product scope (deferred event remains until a later authorized WO restore).
