# Fix Packet — ISSUE-OPS-P1-2026-04-16-002 (LOCAL invoice screen runtime failures: leads 400 + superuser RPC 404 + offline payment 403)

## 1) Issue ID
- ID: ISSUE-OPS-P1-2026-04-16-002
- Links:
  - Founder runtime screenshots: provided (local invoice #863837 / invoice id `974a6759-151a-49be-b7fa-fc8c975c3b1a`)

## 2) Title
- LOCAL CRM invoice screen fails due to missing RPC/columns + missing role seed

## 3) Severity
- P1 (operations blocked locally: can’t reliably load leads / validate superuser gate / record offline payment)

## 4) Environment
- Affected: LOCAL (`http://localhost:3000` + local Supabase gateway `http://127.0.0.1:25431`)
- Not yet claimed for PROD (must not assume)

## 5) Layer(s)
- Data Truth (local schema + migrations)
- CRM Control (invoice page data loading + tenant guard)
- Integrations (edge functions: `invoice-update-status`)

## 6) Root cause
This is a mixed failure (3 independent breakpoints) that all present on the invoice screen:

1) LOCAL DB behind migrations (or not reset after migration changes)
   - `check_is_superuser` RPC not present → UI calls `/rest/v1/rpc/check_is_superuser` and gets 404.

2) Canonical schema gap (migrations vs code)
   - Code selects `contact:contacts!leads_contact_id_fkey(preferred_contact_method)` but canonical `public.contacts` (per `supabase/migrations/20260101_create_money_loop_core_tables.sql`) does not define `preferred_contact_method`.
   - Result: PostgREST 400 error `42703` on leads select.

3) Local user bootstrap gap (roles not seeded)
   - `invoice-update-status` requires `app_user_roles.role ∈ {tech, technician, dispatcher, admin, super_admin}`.
   - In local, the logged-in user has no matching row in `public.app_user_roles`, so offline payment write returns 403.

## 7) Evidence
- LOCAL invoice page shows red toast:
  - “Edge Function returned a non-2xx status code”
- Network evidence (LOCAL):
  - `POST /rest/v1/rpc/check_is_superuser` → `404 Not Found` (PostgREST `PGRST202`)
  - `GET /rest/v1/leads?...contact:contacts!leads_contact_id_fkey(preferred_contact_method)...` → `400 Bad Request` (PostgREST `error:42703`)
  - `POST /functions/v1/invoice-update-status` → `403 Forbidden` (offline payment write blocked)
- Repo evidence:
  - RPC expected by UI:
    - `src/components/TenantGuard.jsx`
    - `src/components/BHFSidebar.jsx`
    - `src/pages/crm/settings/OpsDashboard.jsx`
    - Migration adds RPC: `supabase/migrations/20260416191500_add_superusers_and_check_is_superuser_rpc.sql`
  - Leads select includes the column:
    - `src/pages/crm/InvoiceBuilder.jsx` (lead select string includes `preferred_contact_method`)
  - Payment role enforcement:
    - `supabase/functions/invoice-update-status/index.ts` (`ensureCanRecordPayment`)

## 8) Scope boundary
- IN SCOPE:
  - Restore LOCAL runtime integrity so RVH can be executed credibly.
  - Add minimal additive schema where the UI contract already depends on it.
  - Add a safe local-only bootstrap for roles so offline payment tests can run.
- OUT OF SCOPE:
  - Changing production RLS/roles policies.
  - Re-architecting auth/tenant model.
  - UI redesign.

## 9) Exact files/functions/tables affected
- DB (schema / migrations):
  - `supabase/migrations/20260416191500_add_superusers_and_check_is_superuser_rpc.sql` (must be applied locally)
  - New migration: `supabase/migrations/20260416201500_add_contacts_preferred_contact_method.sql`
  - `public.app_user_roles` (seed rows for local users)
- UI / client:
  - `src/pages/crm/InvoiceBuilder.jsx` (lead select uses contact preferred field)
  - `src/components/TenantGuard.jsx` (calls `check_is_superuser`)
- Edge function:
  - `supabase/functions/invoice-update-status/index.ts` (403 by design when role missing)

## 10) Proposed change
### A) Local schema alignment (fastest unblock)
1. Reset/apply migrations to LOCAL Supabase so RPC + lead preference columns exist:
   - Preferred: `supabase db reset` (destructive to local test data) OR
   - Alternative: apply pending migrations without reset (if your local is precious)

### B) Add missing canonical column (schema gap fix)
2. Add migration (already prepared) to include:
   - `public.contacts.preferred_contact_method text null`
   - No DB constraint enforced yet (keep it permissive to avoid prod migration failures from unexpected legacy values)

### C) Local role bootstrap (permission fix)
3. Ensure the logged-in local admin user has an `app_user_roles` row with `role='admin'` (and optionally tenant-scoped if/when schema has `tenant_id`).
   - Implement as:
     - a small bootstrap script that inserts the row using the local service role key, OR
     - extend `scripts/bootstrap_local_dispatch_users.mjs` to also insert roles + seed `public.superusers` for the local admin email.

## 11) Risks
- Local DB reset will delete local fixtures (acceptable for LOCAL unless you rely on them).
- Adding `contacts.preferred_contact_method` is additive and low-risk, but must remain consistent with the UI’s mapping logic.
- Role seeding must remain LOCAL-only or explicitly controlled; do not accidentally seed roles in PROD via a script.

## 12) Validation steps
- LOCAL:
  1. Confirm `POST /rest/v1/rpc/check_is_superuser` returns `200` (boolean) not `404`.
  2. Reload invoice screen and confirm leads query returns `200` (no PostgREST 400).
  3. Click “Record Payment” → confirm `invoice-update-status` returns `200` and invoice reflects updated paid/partial state.
  4. Run RVH test that covers offline/manual payment: `supabase/tests/node/p0_02b_offline_manual_payment.test.js` or `scripts/runtime/rvh-p0-a-revenue-chain.ps1` (whichever is canonical for your suite).

## 13) Rollback plan
- LOCAL rollback:
  - Re-run `supabase db reset` to return to canonical migrations baseline.
- Schema rollback (if needed):
  - Drop the added column (only if it causes unforeseen breakage; unlikely).
- Script rollback:
  - Remove/disable local-only bootstrap logic.

## 14) Status
- Current: Implemented (LOCAL) — needs UI re-check
- Implementation notes:
  - Local DB reset applied all migrations (including `check_is_superuser` RPC + contacts preference column).
  - Local bootstrap seeded `app_user_roles` + `superusers` for the local admin.
- Evidence:
  - RVH-P0-A PASS after reset/bootstrap (offline payment write no longer 403).
    - Artifacts: `tmp/runtime/2026-04-16/local/rvh-p0-a-20260416_084805/`

## 15) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:
