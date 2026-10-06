# Gate S corrective acceptance mapping

Local evidence is a disposable Postgres 16 database with the finance migrations applied in timestamp order, plus `npm run test:finance`. It is not staging and not production. Playwright finance specs need a local Supabase auth user and were not re-run here (Docker and the Supabase CLI are not available).

| ID | Disposition | Evidence |
|---|---|---|
| A7 | Run locally. Anon REST insert is denied before a row is stored. | `supabase/tests/finance/01_rls_and_version.sql` anon insert expects `insufficient_privilege`. |
| A8 | Run locally. A JWT whose role is not a JSON string is denied. | Same file: array role and missing claims expect `insufficient_privilege`. |
| A9 | Source and unit. The client cannot escalate through localStorage or `user_metadata`. | `src/lib/finance/authz.js` reads only `app_metadata`. `tests/unit/gate-s-corrective.test.mjs` denies a viewer token whose user metadata says admin. |
| C5 | Run in unit tests. A bare HTTP 409 is an ordinary approve failure. | `approvePlan` with `{ status: 409, message: 'conflict' }` returns `finance_approve_failed`. PT409 still maps to `version_conflict`. |
| D1 | Run locally through an authenticated tenant-admin session. | `07_gate_s_corrective.sql`: schema 2 without `monthly_basis` raises `finance_plans_monthly_basis` and stores no row. |
| D5 | Run locally through that same session. | Associate `comparison_plan_id`, then a rebind raises `finance_actuals_basis_locked`. Basis and version stay. |
| D6 | Run locally through that same session. | Changing the three channels so they no longer equal total revenue raises `finance_actuals_channel_reconcile`. Prior amounts stay. |
| E2 | Unit plus Playwright. Intra-finance Back/Forward retains drafts. Cancel stays. Discard leaves. | `dirtyDraft.js`, `leaveGuard.js`, `finance-exit`, `tests/finance/unsaved-nav.spec.js`. Locally verified in Chromium: 3 passed. Screenshots under `/opt/cursor/artifacts/finance-gate-s-corrective/playwright/`. |
| G5 | Locally verified in Chromium. | `tests/finance/reports.spec.js` passed (1 passed, 54.5s), including the 7-digit signed print fit. Print CSS in `FinanceReports.jsx` is unchanged. The report-return Leave planning link uses `print:hidden`. The historical v1 row came from the mock seed, not from executing `seed-v1-historical.sql`. |
| Invalid approve | Run locally. | Direct `finance_approve_plan` of a plan with a missing hurdle, and of a plan with a hurdle of 1, raises `finance_plan_not_approvable`. Status stays `draft` and version stays the pre-call version. |
| postgres 42501 | Traced and reproduced. Not weakened. | `FINANCE_MAINTENANCE_CONTRACT.md`. `07_gate_s_corrective.sql` expects `finance_access_denied` for a postgres plan insert, actuals update, and approve call. |
