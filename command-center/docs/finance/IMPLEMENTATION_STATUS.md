# Financial planning — implementation status

Steps 1–6 of the TVG financial planning model, under the 2026-10-01 Command Center Option B ruling, plus Stage A persistence under the 2026-10-03 Command Center ruling.

- Branch: `cursor/tvg-finance-steps-1-6-a117`
- Baseline: `17f9228951d74824d9b6fb0eb704832befed2afc` (ancestor of this branch)
- Steps 1–6 code commit: `d8ce7d97a29c66b109722022bab107486aca3528`
- Guard/test commit: `7c272fe4b8d07beead373d7a0ba48297429b1a68`
- Stage A harness removal: `66f441d663fac1e9f2018df40d51072dc12988db`
- Stage A persistence: `243f2081bcee8bed254176a87c48f0f6fc7dc839`
- Plan-independent actuals: `bd202f8ef7de07e59ff4bae9ccd5d33b27cf5307`
- Stage B starts from accepted Stage A `7d643f0a25cb9418dc99f6f2b07401e3e1afc7b5`. Monthly Check-In: `5df5090a4a6a89381fb7a3711e53d8dbe7293286`. Challenge correction: `2d41b3a60eec71fea0de97a54101e952e84ee444`. Docs HEAD reviewed by Command Center: `1d631e88f8e171f8039024ab29dc074b5207b41e`.
- Stage B final Playwright gate passed on that exact SHA with no code change: `npx supabase db reset --local --yes`, then `npx playwright test tests/finance/monthly-checkin.spec.js --config=playwright.finance-checkin.config.js` (1 passed). Screenshots are outside git at `/opt/cursor/artifacts/finance-stage-b-1d631e8/`. The spec is not in CI.
- Stage C0 implementation: `58c86e47bd0c832c13a6be02320e8adb3d7b2653`. It adds the analytics inventory, metric dictionary, and plan-basis design, retires hard-coded Business Analytics figures, and blocks check-in Save after a version conflict until Reload replaces the form from the server row.
- Stage C0 correction is on top of `f75ca9c9c1f5d55a33ed230481d2e3df035f496c`. It adds a structural analytics guard and L4 wiring asserts, and extends the plan-basis contract and metric dictionary. Command Center accepted that correction at `3044056138469f7f4fcd44df10b955d54d20e1cf`.
- Stage C1 starts from that SHA. It adds `20261003180000_finance_plan_monthly_basis.sql`: plan schema version 2, `inputs.monthly_basis` for the 13 check-in fact fields, database validation of that map, and `finance_upgrade_draft_schema`. Version 1 plans stay without a monthly basis. A version 1 draft upgrades in place. An approved version 1 plan opens a new version 2 draft with an empty map. An approved version 2 plan opens a new draft that copies its map. Check-in Plan and Variance use only the plan named by `comparison_plan_id`. A history click does not clear a check-in conflict. Business Analytics no longer treats a query error, a missing price, or a mixed conversion ratio as a measured zero, and the scheduled-price card is not styled as revenue. Stage C2 and Stage D are not started.
- Draft PR: https://github.com/faydog127/BHFOS/pull/164 (do not merge)
- Evidence tier: **locally verified**. Not deployed, not staging-verified, not merged, not production-verified.
- Clean local reset: `npx supabase db reset --local --yes` on an unlinked stack exited 0 and applied through `20261003180000_finance_plan_monthly_basis.sql`. Finance SQL tests 01, 02, 03, 04, 05, and 06 then passed and rolled back. That stack was not linked to a remote project. The prior reset evidence stopped at `20261003145000_finance_actuals_known_channel_ceiling.sql`.
- Stage C1 Monthly Check-In Playwright passed on implementation `ba862d839730003ea80c563ec22f8cefe0030bef`: `npx playwright test tests/finance/monthly-checkin.spec.js --config=playwright.finance-checkin.config.js` (1 passed). Screenshots are outside git at `/opt/cursor/artifacts/finance-stage-c1-ba862d8/`. The spec is not in CI. A docs-only tip re-runs the same spec.
- Route: `/:tenantId/finance/*` → `TenantGuard` → `FinanceGuard` → `FinanceShell`. The shell is not inside `BHFCrmLayout`.
- Data: synthetic illustration remains in the unit fixture only (`SYNTHETIC — NOT TVG DATA`). Stored plans are blank inputs. No workbook seeds in git. No finance seed migration.
- Stage A adds `finance_plans` and `finance_monthly_actuals` in `supabase/migrations/20261003053000_finance_stage_a_persistence.sql`, with security fixes in `20261003063000_finance_stage_a_security_fixes.sql`, one draft per tenant in `20261003113216_finance_one_draft_per_tenant.sql`, and plan-independent actuals in `20261003132212_finance_actuals_plan_independent.sql`. Three modes and Reports are not started.
- One draft per tenant is database-enforced. `finance_open_draft` returns the existing draft. One approved plan per tenant remains.
- Monthly actuals are one row per tenant and month. `comparison_plan_id` is a nullable comparison basis, not ownership. An actual may exist with no plan. Once that basis is set, superseding the plan does not detach or rewrite it, and the basis, tenant, and month cannot be rebound. Factual corrections stay allowed after supersession, with server-side version, `updated_by_user_id`, and `updated_at`. There is no DELETE.
- Total Revenue is earned operating revenue for work completed in the reporting month. It is not invoice issue-date volume, cash collected, quoted value, or scheduled value. The three channel fields use that same basis. If all three are present they must equal Total Revenue. If Total Revenue is present, the sum of the known channel amounts cannot exceed it. A missing channel stays null. AR and cash stay separate.
- Monthly Check-In can create and correct one actual per month, with manual provenance and an optional source note. Association of an approved comparison plan is explicit and one-time. Schema version 1 has no declared monthly basis, so Plan and Variance stay `--`. Schema version 2 shows Plan and Variance only for metrics stored on that month of the associated plan. Null is not planned. Zero is a planned zero. Derived check-in figures are display-only and use the existing null-safe division. Portal share and direct share stay blank unless all three channel amounts are present. There is no delete. In-place versioned corrections do not keep a prior-value ledger. After a version conflict, choosing a history month does not load the cached row.
- Actual provenance is `source = manual_entry` plus an optional source note. No external import is authorized.
- For completed work, `jobs` / `job_operational_state_v1` are the operational starting point. Appointments are scheduling records. Business Analytics summing appointment `pricing_snapshot.price` is not Finance revenue authority. `Reporting.jsx` still only mounts the dashboard. A failed query, an incomplete price, and the retired conversion rate show `unavailable / not connected`. The appointment-price series stays, labeled `Scheduled appointment price — not earned operating revenue`, with neutral styling. Invoiced amount and Cash collected stay unavailable.
- `owner` stays denied. There is no owner-to-admin mapping.
- Finance writes are off unless the Vite environment is development or test, the caller passes `local: true`, or `VITE_FINANCE_SYNTHETIC_ONLY=approved-synthetic`. An absent build environment leaves writes off. Preview and production builds do not set that flag. The gate does not name a remote host. The screen shows “Finance writes are disabled. This screen is read-only.”
- Private check: `npm run finance:verify -- <gitignored-json>`. Prints test identity, PASS/FAIL, and tolerances only.

## Authorization boundary

Draft PR only. No merge, no push to the default branch, no production or staging deploy, no `supabase link`, no `db push`, no remote migration. Production `wwyxohjnyqnegzbxtuxs`, BHFOS n8n Assurance Preview `glkrykpksbsqmmilmjhs`, and BHFOS Command Center Staging `exwochkjngdztrdtxnsa` were not contacted. No service-role key in the frontend.

No real TVG data may be entered in any Vercel Preview or staging environment. The finance migration is not applied to any remote project by PR #164. Preview must use a non-production Supabase project, or none. Applying the migration anywhere requires explicit Command Center authorization.

## Unresolved

- A broader accounting-restatement workflow is not built. Factual corrections update the row in place. That is an accepted limitation for this release.
- Schema version 1 still has no declared monthly check-in series. Plan and Variance stay `--`. Stage scenario revenue is not a monthly basis. Version 2 is `docs/finance/MONTHLY_PLAN_BASIS_CONTRACT.md`, stored only through `20261003180000_finance_plan_monthly_basis.sql`. That migration is not applied on any remote project.
- Who applies a migration to staging or production is not this stage. This stage does not apply the migration remotely.
- The Preview Supabase host still cannot be identified from the repo. Writes stay disabled there unless a build sets `VITE_FINANCE_SYNTHETIC_ONLY=approved-synthetic`.
- `version_conflict` is also returned when row level security hides the row. The client does not distinguish a hidden row from a stale version.
- After a check-in `version_conflict`, Save stays blocked until Reload. Reload loads the latest server row and replaces the form with that row. Unsaved edits are discarded. There is no merge. Choosing a history month while the conflict is open does not clear it and does not load the cached row. The plan editor's own Reload already replaces plan inputs from the server.
- The Playwright check-in spec is not part of CI. It needs a freshly reset local database. The spec now also covers a version 2 plan with a partial monthly basis.
- Referral partner commission totals still coerce a missing `commission_amount` with `|| 0`. That figure is not charted and is not a Finance metric.
- `finance.plan_transition` can be set by direct SQL in the same session, the same way `approve` already could. The app does not set it except inside the approve and upgrade functions.

## Next action

Challenge review of Stage C1 on draft PR https://github.com/faydog127/BHFOS/pull/164. Do not start Stage C2 or Stage D. Do not merge. Staging apply requires separate Command Center authorization; the staging ref is `exwochkjngdztrdtxnsa`.
