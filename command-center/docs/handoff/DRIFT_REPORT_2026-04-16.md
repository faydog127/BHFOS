# CRM Drift Report (Supabase PROD vs `supabase/migrations/`)

Generated: 2026-04-16  
Repo: `c:\BHFOS\command-center` (git top-level: `C:\BHFOS`)  

## Scope / Rules

- Canonical schema source-of-truth: `supabase/migrations/`
- Remote schema evidence source: `tmp/prod_public.sql` (generated via `supabase db dump --linked --schema public`)
- Mode: Audit-only (no code changes, no migrations applied)

### Drift Classification

- **A) DB drift**: PROD is missing / differs from what `supabase/migrations/` defines → remediation: apply missing migrations **or** add an explicit drift-fix migration (idempotent `ALTER TABLE ...`) when `CREATE TABLE IF NOT EXISTS ...` cannot converge an existing legacy table.
- **B) Code drift**: App code expects columns/behavior that are not present in canonical migrations → remediation: code fix **or** propose a new migration (explicitly justified).

## Executive Summary (High Signal)

1) PROD `public.leads` is missing `updated_at`, but canonical migrations + app code assume it exists → confirmed cause of scheduling failures.  
2) PROD `public.invoices.public_token` is **text**, but canonical migrations define it as **uuid** → this breaks the intended public-pay contract and creates cross-table type mismatches.  
3) PROD `public.public_payment_attempts.public_token` is **uuid**; `public-pay` writes the invoice token into it → likely runtime failure if invoice token is not a UUID (and PROD’s default invoice token is hex text).  
4) Canonical migrations currently rely on `CREATE TABLE IF NOT EXISTS ...` for foundational tables; that cannot “upgrade” an already-existing PROD table shape → drift can persist silently unless drift-fix migrations exist.  
5) `public.public_payment_attempts` appears to be accessible to `anon` and lacks explicit RLS policies in canonical migrations → security gap that should be closed with a new migration (explicitly justified).

## Drift Table (Schema-Related)

### DRIFT-001 — `public.leads.updated_at` missing in PROD (scheduler blocker)

- **Severity:** P1 (operations blocked: scheduling)
- **Classification:** **A) DB drift**
- **Canonical (migrations):**
  - `supabase/migrations/20260101_create_money_loop_core_tables.sql:69` defines `public.leads.updated_at timestamptz not null default now()`
- **PROD (schema dump):**
  - `tmp/supabase_remote_public.sql:8126` shows `CREATE TABLE IF NOT EXISTS "public"."leads" (...)` **without** an `updated_at` column
- **Code evidence:**
  - `src/services/appointmentService.js:100` selects `updated_at` (conditionally) and uses it for ordering
  - `src/services/appointmentService.js:109` orders by `updated_at`
- **Runtime evidence (observed):**
  - App error reported earlier: `column leads.updated_at does not exist`
- **Recommended remediation:**
  - Add an explicit drift-fix migration: `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at timestamptz not null default now();`
  - Apply migrations to PROD (after review + backup discipline).
- **Risk notes:**
  - Adding `updated_at` is low risk, but you should also add a trigger to maintain it (or ensure code updates it on writes).

---

### DRIFT-002 — `public.invoices.invoice_number` type differs (canonical text vs PROD integer)

- **Severity:** P2 (workflow + traceability drift; can break assumptions in UI/integrations)
- **Classification:** **A) DB drift** (relative to canonical migrations)
- **Canonical (migrations):**
  - `supabase/migrations/20260101_create_money_loop_core_tables.sql:158` defines `invoice_number text`
- **PROD (schema dump):**
  - `tmp/supabase_remote_public.sql:7991` defines `"invoice_number" integer NOT NULL`
  - PROD also has sequence ownership: `tmp/supabase_remote_public.sql:8041` (`invoices_invoice_number_seq` owned by invoices.invoice_number)
- **Recommended remediation (decision required):**
  - Decide canonical contract: keep **integer sequence** (recommended for operational numbering) or revert to **text**.
  - If integer is the intended reality, update canonical migrations with an explicit migration that sets the type + sequence in a forward-safe way.
- **Risk notes:**
  - Type changes on a populated table can be risky; treat as a controlled migration, not ad-hoc.

---

### DRIFT-003 — `public.invoices.public_token` type differs (canonical uuid vs PROD text)

- **Severity:** P0 (revenue flow: pay links)
- **Classification:** **A) DB drift** (relative to canonical migrations)
- **Canonical (migrations):**
  - `supabase/migrations/20260101_create_money_loop_core_tables.sql:175` defines `public_token uuid unique default gen_random_uuid()`
- **PROD (schema dump):**
  - `tmp/supabase_remote_public.sql:7991` defines `"public_token" "text" DEFAULT encode(extensions.gen_random_bytes(16), 'hex')`
- **Code evidence (public pay chain uses token as string):**
  - `supabase/functions/public-pay/index.ts:157` looks up invoice via `.eq('public_token', token)`
  - `supabase/functions/public-pay/index.ts:488` uses the same `token` when writing `public_payment_attempts.public_token`
- **Recommended remediation (decision required; affects live links):**
  - **Option A (align to PROD reality, likely safest for revenue):** Treat invoice `public_token` as opaque **text** moving forward; update canonical migrations (new migration) and adjust dependent tables to accept text tokens (see DRIFT-004).
  - **Option B (align PROD to canonical uuid):** Migrate PROD `invoices.public_token` to uuid and backfill/translate existing hex tokens (high risk: breaks existing links unless you keep compatibility).
- **Risk notes:**
  - This is a contract decision: you can’t safely “force uuid” without a compatibility plan.

---

### DRIFT-004 — Cross-table token mismatch: `public_payment_attempts.public_token` is uuid but invoice tokens are text in PROD

- **Severity:** P0 (revenue flow: pay initiation DB write)
- **Classification:** **B) Code drift** *and/or* **schema contract mismatch** (requires explicit migration proposal)
- **Canonical (migrations):**
  - `supabase/migrations/20260404230000_p0_02d_public_pay_initiation_attempts.sql:14` defines `public_payment_attempts.public_token uuid not null`
- **PROD (schema dump):**
  - `tmp/supabase_remote_public.sql:9381` defines `"public_token" "uuid" NOT NULL`
- **Why this is a problem in PROD:**
  - PROD invoices generate a hex string token by default (`tmp/supabase_remote_public.sql:7991`), which is **not** a UUID.
  - `public-pay` writes `token` into `public_payment_attempts.public_token` (`supabase/functions/public-pay/index.ts:488`).
- **Recommended remediation (explicitly justified new migration needed):**
  - Safest path is to avoid forcing UUID parsing:
    - Change `public_payment_attempts.public_token` to `text` **or**
    - Add `public_token_text text not null` (plus backfill) and stop writing to the uuid column (keep uuid only if you truly standardize invoice tokens to uuid).
- **Risk notes:**
  - Until this is fixed, “pay link works” can be false even if Stripe keys are correct, because the DB write can fail.

---

### DRIFT-005 — Canonical cannot converge legacy PROD tables via `CREATE TABLE IF NOT EXISTS` (silent drift persistence)

- **Severity:** P1 (blocks safe “apply missing migrations” remediation)
- **Classification:** **A) DB drift remediation gap**
- **Evidence:**
  - Canonical base migration defines a minimal `public.leads` with `updated_at` (`supabase/migrations/20260101_create_money_loop_core_tables.sql:51`), but PROD already has a much larger legacy `public.leads` shape (`tmp/supabase_remote_public.sql:8126`) and will not be “upgraded” by a `CREATE TABLE IF NOT EXISTS`.
- **Recommended remediation:**
  - When a table already exists in PROD, use explicit drift-fix migrations:
    - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
    - `ALTER TABLE ... ALTER COLUMN ... TYPE ...` (only with compatibility plan)

---

### DRIFT-006 — `public.jobs.estimate_id` exists in PROD (legacy) but is not in canonical migrations (contract drift risk)

- **Severity:** P2 (model/contract drift; can confuse cross-system logic)
- **Classification:** **A) DB drift** (relative to canonical migrations)
- **Canonical (migrations):**
  - `supabase/migrations/20260101_create_money_loop_core_tables.sql:132` defines `public.jobs` **without** `estimate_id`
- **PROD (schema dump):**
  - `tmp/prod_public.sql:8081` shows `CREATE TABLE IF NOT EXISTS "public"."jobs" (...)` including `"estimate_id" "uuid"`
- **Trigger/function evidence (PROD schema dump):**
  - `tmp/prod_public.sql:1288` shows `public.ensure_job_and_optional_draft_invoice_for_accepted_quote()` inserting `estimate_id` into `public.jobs`
- **Why this matters:**
  - Business contract has been locked to quote→job (`jobs.quote_id` canonical). `estimate_id` in jobs should be treated as legacy (optional) and not relied upon for job identity.
- **Recommended remediation:**
  - Apply the contract-alignment migration that removes `estimate_id` from the active quote→job trigger insert path (do not drop the legacy column yet).
  - Track remediation as: `docs/handoff/FIX_PACKET_ISSUE-OPS-P1-2026-04-16-001_jobs_estimate_id.md`

---

## Security / Policy Gap (Requires New Migration Proposal)

### GAP-SEC-001 — `public_payment_attempts` appears overly accessible (anon grants, no explicit RLS policies)

- **Severity:** P0 (security/system integrity)
- **Evidence (PROD schema dump):**
  - `tmp/supabase_remote_public.sql:16733` grants: `GRANT ALL ON TABLE "public"."public_payment_attempts" TO "anon";`
  - No canonical migration currently enables RLS / policies for `public_payment_attempts` (table is created in `supabase/migrations/20260404230000_p0_02d_public_pay_initiation_attempts.sql` without RLS statements).
- **Recommended remediation:**
  - New migration: enable RLS + minimal policies; reduce grants for `anon` (or rely on edge functions only).
- **Risk notes:**
  - This is independent of whether payments “work”; it is about whether payments are safe.

## Next Step (Audit-Only → Execution Candidate)

1) Decide token contract (uuid vs text) for invoice pay links.  
2) Draft a small set of drift-fix migrations (no refactors) covering:
   - `leads.updated_at`
   - payment token alignment (`invoices.public_token` + `public_payment_attempts.public_token`)
   - RLS/policies for public payment tables  
3) Only after review: apply to a staging clone first, then PROD.
