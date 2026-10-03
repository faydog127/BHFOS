# Financial planning — implementation status

Steps 1–6 of the TVG financial planning model, under the 2026-10-01 Command Center Option B ruling, plus Stage A persistence under the 2026-10-03 Command Center ruling.

- Branch: `cursor/tvg-finance-steps-1-6-a117`
- Baseline: `17f9228951d74824d9b6fb0eb704832befed2afc` (ancestor of this branch)
- Steps 1–6 code commit: `d8ce7d97a29c66b109722022bab107486aca3528`
- Guard/test commit: `7c272fe4b8d07beead373d7a0ba48297429b1a68`
- Stage A harness removal: `66f441d663fac1e9f2018df40d51072dc12988db`
- Stage A persistence: `243f2081bcee8bed254176a87c48f0f6fc7dc839`
- Draft PR: https://github.com/faydog127/BHFOS/pull/164 (do not merge)
- Evidence tier: **locally verified**. Not deployed, not staging-verified, not merged, not production-verified.
- Clean local reset: `npx supabase db reset --local` on an unlinked stack exited 0, then finance SQL tests 01, 02, and 03 passed and rolled back. That stack was not linked to a remote project.
- Route: `/:tenantId/finance/*` → `TenantGuard` → `FinanceGuard` → `FinanceShell`. The shell is not inside `BHFCrmLayout`.
- Data: synthetic illustration remains in the unit fixture only (`SYNTHETIC — NOT TVG DATA`). Stored plans are blank inputs. No workbook seeds in git. No finance seed migration.
- Stage A adds `finance_plans` and `finance_monthly_actuals` in `supabase/migrations/20261003053000_finance_stage_a_persistence.sql`, with security fixes in `20261003063000_finance_stage_a_security_fixes.sql` and one draft per tenant in `20261003113216_finance_one_draft_per_tenant.sql`. Monthly Check-In UI, three modes, and Reports are not started.
- One draft per tenant is database-enforced. `finance_open_draft` returns the existing draft. Superseded actuals stay on their original plan and are read-only. Factual corrections are allowed only while that plan is still `approved`, with server-side version, `updated_by_user_id`, and `updated_at`.
- `owner` stays denied. There is no owner-to-admin mapping.
- Finance writes are off unless the build is local (`vite` dev, test, or a non-bundled local run) or `VITE_FINANCE_SYNTHETIC_ONLY=approved-synthetic`. Preview and production builds do not set that flag. The gate does not name a remote host. The screen shows “Finance writes are disabled. This screen is read-only.”
- Private check: `npm run finance:verify -- <gitignored-json>`. Prints test identity, PASS/FAIL, and tolerances only.

## Authorization boundary

Draft PR only. No merge, no push to the default branch, no production or staging deploy, no `supabase link`, no `db push`, no remote migration. Production `wwyxohjnyqnegzbxtuxs` and staging `glkrykpksbsqmmilmjhs` were not contacted. No service-role key in the frontend.

No real TVG data may be entered in any Vercel Preview or staging environment. The finance migration is not applied to any remote project by PR #164. Preview must use a non-production Supabase project, or none. Applying the migration anywhere requires explicit Command Center authorization.

## Unresolved

- A later historical-restatement workflow for superseded actuals is Stage B or later. This stage does not invent one.
- Who applies a migration to staging or production is not this stage. This stage does not apply the migration remotely.
- The Preview Supabase host still cannot be identified from the repo. Writes stay disabled there unless a build sets `VITE_FINANCE_SYNTHETIC_ONLY=approved-synthetic`.

## Next action

Challenge re-review of the Stage A completion on draft PR https://github.com/faydog127/BHFOS/pull/164. Stages B, C, and D stay held.
