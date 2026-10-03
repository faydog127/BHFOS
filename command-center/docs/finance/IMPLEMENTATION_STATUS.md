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
- Route: `/:tenantId/finance/*` → `TenantGuard` → `FinanceGuard` → `FinanceShell`. The shell is not inside `BHFCrmLayout`.
- Data: synthetic illustration remains in the unit fixture only (`SYNTHETIC — NOT TVG DATA`). Stored plans are blank inputs. No workbook seeds in git. No finance seed migration.
- Stage A adds `finance_plans` and `finance_monthly_actuals` in `supabase/migrations/20261003053000_finance_stage_a_persistence.sql`. Monthly Check-In UI, three modes, and Reports are not started.
- Private check: `npm run finance:verify -- <gitignored-json>`. Prints test identity, PASS/FAIL, and tolerances only.

## Authorization boundary

Draft PR only. No merge, no push to the default branch, no production or staging deploy, no `supabase link`, no `db push`, no remote migration. Production `wwyxohjnyqnegzbxtuxs` and staging `glkrykpksbsqmmilmjhs` were not contacted. No service-role key in the frontend.

No real TVG data may be entered in any Vercel Preview or staging environment. The finance migration is not applied to any remote project by PR #164. Preview must use a non-production Supabase project, or none. Applying the migration anywhere requires explicit Command Center authorization.

## Unresolved

- More than one draft plan can exist. A partial unique index for one draft per tenant is not in this branch. That needs a Command Center ruling.
- Who runs a clean `supabase db reset` and the finance SQL tests before any staging apply is unresolved. `npx supabase db reset` failed in the environment that wrote this branch (database container setup exited 1). This stage does not apply the migration remotely.

## Next action

Challenge re-review of the Stage A security fixes on draft PR https://github.com/faydog127/BHFOS/pull/164. Stages B, C, and D stay held.
