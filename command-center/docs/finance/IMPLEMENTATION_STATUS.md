# Financial planning — implementation status

Steps 1–6 of the TVG financial planning model, under the 2026-10-01 Command Center Option B ruling, plus Stage A persistence under the 2026-10-03 Command Center ruling.

- Branch: `cursor/tvg-finance-steps-1-6-a117`
- Baseline: `17f9228951d74824d9b6fb0eb704832befed2afc` (ancestor of this branch)
- Steps 1–6 code commit: `d8ce7d97a29c66b109722022bab107486aca3528`
- Guard/test commit: `7c272fe4b8d07beead373d7a0ba48297429b1a68`
- Stage A harness removal: `66f441d663fac1e9f2018df40d51072dc12988db`
- Stage A persistence: `243f2081bcee8bed254176a87c48f0f6fc7dc839`
- Plan-independent actuals: `bd202f8ef7de07e59ff4bae9ccd5d33b27cf5307`
- Stage B starts from accepted Stage A `7d643f0a25cb9418dc99f6f2b07401e3e1afc7b5`. Monthly Check-In: `5df5090a4a6a89381fb7a3711e53d8dbe7293286`. Stages C and D are not started.
- Draft PR: https://github.com/faydog127/BHFOS/pull/164 (do not merge)
- Evidence tier: **locally verified**. Not deployed, not staging-verified, not merged, not production-verified.
- Clean local reset: `npx supabase db reset --local` on an unlinked stack exited 0 and applied through `20261003145000_finance_actuals_known_channel_ceiling.sql`. Finance SQL tests 01, 02, 03, 04, and 05 then passed and rolled back. That stack was not linked to a remote project.
- Route: `/:tenantId/finance/*` → `TenantGuard` → `FinanceGuard` → `FinanceShell`. The shell is not inside `BHFCrmLayout`.
- Data: synthetic illustration remains in the unit fixture only (`SYNTHETIC — NOT TVG DATA`). Stored plans are blank inputs. No workbook seeds in git. No finance seed migration.
- Stage A adds `finance_plans` and `finance_monthly_actuals` in `supabase/migrations/20261003053000_finance_stage_a_persistence.sql`, with security fixes in `20261003063000_finance_stage_a_security_fixes.sql`, one draft per tenant in `20261003113216_finance_one_draft_per_tenant.sql`, and plan-independent actuals in `20261003132212_finance_actuals_plan_independent.sql`. Monthly Check-In UI, three modes, and Reports are not started.
- One draft per tenant is database-enforced. `finance_open_draft` returns the existing draft. One approved plan per tenant remains.
- Monthly actuals are one row per tenant and month. `comparison_plan_id` is a nullable comparison basis, not ownership. An actual may exist with no plan. Once that basis is set, superseding the plan does not detach or rewrite it, and the basis, tenant, and month cannot be rebound. Factual corrections stay allowed after supersession, with server-side version, `updated_by_user_id`, and `updated_at`. There is no DELETE. The screen does not load or enter actuals.
- Total Revenue is earned operating revenue for work completed in the reporting month. It is not invoice issue-date volume, cash collected, quoted value, or scheduled value. The three channel fields use that same basis. If all three are present they must equal Total Revenue. If Total Revenue is present, the sum of the known channel amounts cannot exceed it. A missing channel stays null. AR and cash stay separate.
- Monthly Check-In can create and correct one actual per month, with manual provenance and an optional source note. Association of an approved comparison plan is explicit and one-time. Schema version 1 has no declared monthly basis, so Plan and Variance stay blank. Stage required revenue is not used as that basis. Derived check-in figures are display-only and use the existing null-safe division. There is no delete. In-place versioned corrections do not keep a prior-value ledger.
- Actual provenance is `source = manual_entry` plus an optional source note. No external import is authorized.
- For completed work, `jobs` / `job_operational_state_v1` are the operational starting point. Appointments are scheduling records. Business Analytics summing appointment `pricing_snapshot.price` is not Finance revenue authority. This round does not change `Reporting.jsx`.
- `owner` stays denied. There is no owner-to-admin mapping.
- Finance writes are off unless the build is local (`vite` dev, test, or a non-bundled local run) or `VITE_FINANCE_SYNTHETIC_ONLY=approved-synthetic`. Preview and production builds do not set that flag. The gate does not name a remote host. The screen shows “Finance writes are disabled. This screen is read-only.”
- Private check: `npm run finance:verify -- <gitignored-json>`. Prints test identity, PASS/FAIL, and tolerances only.

## Authorization boundary

Draft PR only. No merge, no push to the default branch, no production or staging deploy, no `supabase link`, no `db push`, no remote migration. Production `wwyxohjnyqnegzbxtuxs` and staging `glkrykpksbsqmmilmjhs` were not contacted. No service-role key in the frontend.

No real TVG data may be entered in any Vercel Preview or staging environment. The finance migration is not applied to any remote project by PR #164. Preview must use a non-production Supabase project, or none. Applying the migration anywhere requires explicit Command Center authorization.

## Unresolved

- A broader accounting-restatement workflow is not built. Factual corrections update the row in place. That is an accepted limitation for this release.
- Schema version 1 has no declared monthly check-in series. Plan and Variance stay blank. Stage scenario revenue is not treated as a monthly basis.
- Who applies a migration to staging or production is not this stage. This stage does not apply the migration remotely.
- The Preview Supabase host still cannot be identified from the repo. Writes stay disabled there unless a build sets `VITE_FINANCE_SYNTHETIC_ONLY=approved-synthetic`.

## Next action

Challenge re-review of Stage B Monthly Check-In on draft PR https://github.com/faydog127/BHFOS/pull/164. Stages C and D stay held. Documentation that names `glkrykpksbsqmmilmjhs` as Command Center staging is not corrected in this stage.
