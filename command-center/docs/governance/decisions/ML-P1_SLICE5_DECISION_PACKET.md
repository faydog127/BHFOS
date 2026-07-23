# Decision Packet — ML-P1 Slice 5 (Invoice Generation)

| Field | Value |
| --- | --- |
| Disposition | **SLICE5_PLANNING_REQUIRES_CODING_AUTH** (product decisions **RATIFIED**) |
| Planning base (exact `origin/main`) | `e9cc3317fcb9c84f44643700927699f40c7f1a93` |
| Branch | `plan/ml-p1-s5-invoice-generation` |
| Prior slices | S1–S4 closed; price-book **A2-MERGED**; invoice-on-complete **disabled** |
| Coding | **Not authorized** until this planning PR merges and Founder grants coding auth |
| Supersedes | Draft packet on prior tip `84452db` (base `3bb175e`) |

## Purpose

Completed canonical job → **exactly one** canonical **`final`** invoice (`draft` → office review → issue as persisted `sent` / display “Issued”), with lineage from approved quote + approved change orders. Stop before Stripe (S5b) and autonomous follow-up (S6).

## Live baseline (revalidated 2026-07-23 against linked prod)

| Fact | Evidence |
| --- | --- |
| Invoices | **25** rows; `draft` 2 · `sent` 14 · `paid` 9 |
| Uniqueness | `idx_invoices_unique_job`, `idx_invoices_one_active_per_job`, `invoices_one_draft_per_job_type_uq` present |
| S4 gate (source on main) | `ML_P1_S4_INVOICE_ON_COMPLETE_ENABLED = false` in `work-order-update` |
| Kanban | `ML_P1_S4_INVOICE_PATH_DENY` still denies invoice create |
| Config (repo) | `auto_create_draft_invoice_on_acceptance` seeded `false` |
| Schema | `invoice_type` CHECK still allows deposit/progress/final; **S5 product creates `final` only** (PD-S5-03 A) |

## Ratified product decisions (Founder 2026-07-23)

### PD-S5-01 — Invoice creation trigger → **C (Hybrid)** RATIFIED
- Auto-create **draft** when eligible job reaches `completed` (S4 readiness pass, no pending COs, no existing blocking invoice).
- Office may create draft if auto-create did not occur.
- Remains **draft** until office review and **explicit issue**.
- **Never** auto-issue or auto-send.

### PD-S5-02 — Issued status vocabulary → **C** RATIFIED
- Persist issued state as **`sent`**.
- Display office/customer label **“Issued”** where appropriate.
- **No** database status rename migration.

### PD-S5-03 — `invoice_type` → **A** RATIFIED
- S5 creates **`final`** invoices only.
- Do not expose deposit/progress creation in S5 UI/RPC.
- Keep schema CHECK for compatibility; do not drop columns for migration risk avoidance.

### PD-S5-04 — Tax at invoice creation → **B+C** RATIFIED
- Default tax from **approved quote financial snapshot**.
- Authorized office may correct tax while status is **draft**.
- **Freeze** tax and all invoice financial values when issued (`sent`).
- **Never** silently recalculate an issued invoice from current pricebook or tax settings.

### PD-S5-05 — Void and write-off authority → **A** RATIFIED
- Void: **office | manager | admin** (reason + immutable audit required).
- Write-off: **admin only** (reason + immutable audit required).
- Technicians **never** void, write off, or modify invoice financial values.

### PD-S5-06 — Correction after issue (unpaid) → **A** RATIFIED
- Issued unpaid invoices **may not** be edited in place.
- Corrections = **void + reissue**.
- Preserve original issued invoice and audit history.

### PD-S5-07 — Pre-existing invoices (25) → **A** RATIFIED
- **Grandfather** the 25 live invoices.
- Do **not** rewrite or reprice historical financial data.
- Canonical S5 writer applies to **new** creates.
- Safe best-effort lineage backfill only (no changes to historical amounts, statuses, or customer-visible records).

## Explicit non-scope

Slice 5b Stripe · refunds · payment reconciliation · Slice 6 autonomous follow-up · TIS · G2.3 · multi-tenancy · pricebook optimization · historical invoice reprice.

## Coding gate (after this planning PR merges)

Requires separate Founder line: **authorize Slice 5 coding** on exact branch/base SHA.  
Until then: **no migrations, no app implementation, no deploy.**
