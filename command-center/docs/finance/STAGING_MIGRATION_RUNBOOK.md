# Finance staging migration runbook

Documentation only. Do not execute this runbook from the pre-staging hardening change.
Staging apply is not authorized. Production apply is not authorized.

Future staging project ref, named only: `exwochkjngdztrdtxnsa`.
Do not link this checkout to that project. Do not run `supabase link`, `supabase db push`, or `supabase db reset` against it.

Out of bounds, do not contact:

- production `wwyxohjnyqnegzbxtuxs`
- n8n Assurance Preview `glkrykpksbsqmmilmjhs`
- Command Center staging `exwochkjngdztrdtxnsa`

## What a later authorized apply would run

Forward migrations only. Do not edit a migration that has already been applied.
The new file is `supabase/migrations/20261003223000_finance_plan_v2_required_sections.sql`.
It replaces `finance_plan_document_ok` and rebuilds `finance_plans_monthly_basis`.
It does not edit `20261003180000_finance_plan_monthly_basis.sql`.
It does not seed rows, rewrite facts, or delete.

Finance migration order through this change:

1. `20261003053000_finance_stage_a_persistence.sql`
2. `20261003063000_finance_stage_a_security_fixes.sql`
3. `20261003113216_finance_one_draft_per_tenant.sql`
4. `20261003132212_finance_actuals_plan_independent.sql`
5. `20261003145000_finance_actuals_known_channel_ceiling.sql`
6. `20261003180000_finance_plan_monthly_basis.sql`
7. `20261003223000_finance_plan_v2_required_sections.sql`

## Operator sequence, when Command Center authorizes staging

1. Confirm the target ref is the staging project and not production or the n8n preview.
2. Run the malformed-plan preflight in `MALFORMED_PLAN_PREFLIGHT.md` against that database. If it returns any row, stop. Repair those drafts with an ordinary admin update to a valid version 2 document before applying. There is no replace-invalid-draft button.
3. Take a database backup through the host's backup control. This repository does not store that backup.
4. Apply the pending forward migrations with the authorized Supabase workflow. Do not hand-edit an applied file.
5. Re-run the preflight. It must return zero rows.
6. Confirm `finance_plans` still has no DELETE grant for `authenticated`, RLS is forced, and `finance_actuals_schema_version` is still version 1 only.
7. Confirm one draft per tenant and one approved plan per tenant still hold.
8. Smoke the eight reports with synthetic data only. Do not load real TVG finance data.

## Local proof, already the hardening command

On an unlinked local stack:

```bash
cd command-center
npx supabase db reset --local --yes
```

Then run `supabase/tests/finance/01` through `06` with `psql` against the local URL. Each file begins a transaction and rolls it back.

## If the new constraint fails on apply

The rebuild validates every existing `finance_plans` row. A version 2 row that is only `{monthly_basis:{}}`, that uses month `0000-01-01`, or that is missing `structural`, `stages`, `staffing`, `owner_field_replacement`, `cost_pools`, `channels`, or `services` will stop the migration. Version 1 rows are still valid without those sections, as long as they have no `monthly_basis` key. Do not drop the constraint to force the apply through.
