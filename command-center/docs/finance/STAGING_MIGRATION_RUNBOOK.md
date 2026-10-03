# Finance staging migration runbook

Documentation only. Do not execute this runbook from the hardening change.
Staging apply is not authorized until Command Center opens that gate. Production apply is not authorized.

Future staging project ref, named only: `exwochkjngdztrdtxnsa`.
Do not link this checkout to that project. Do not run `supabase link`, `supabase db push`, or `supabase db reset` against it.

Out of bounds, do not contact:

- production `wwyxohjnyqnegzbxtuxs`
- n8n Assurance Preview `glkrykpksbsqmmilmjhs`
- Command Center staging `exwochkjngdztrdtxnsa`

## Target project ref

Before any command that can write, the operator reads the linked project ref from the host's own project list and checks all of the following. Stop if any check fails.

1. The ref equals `exwochkjngdztrdtxnsa`.
2. The ref is not `wwyxohjnyqnegzbxtuxs`.
3. The ref is not `glkrykpksbsqmmilmjhs`.
4. The checkout is not the one used for this hardening change unless Command Center has opened the staging gate on that checkout.

This repository does not run that check. Phase H did not contact any of those projects.

## What a later authorized apply would run

Forward migrations only. Do not edit a migration that has already been applied.
The newest Finance file is `supabase/migrations/20261003223000_finance_plan_v2_required_sections.sql`.
Phase H does not add another migration. It does not edit `20261003180000_finance_plan_monthly_basis.sql` or `20261003223000`.
The version 2 file replaces `finance_plan_document_ok` and rebuilds `finance_plans_monthly_basis`.
It does not seed rows, rewrite facts, or delete.

Exact Finance migration order:

1. `20261003053000_finance_stage_a_persistence.sql`
2. `20261003063000_finance_stage_a_security_fixes.sql`
3. `20261003113216_finance_one_draft_per_tenant.sql`
4. `20261003132212_finance_actuals_plan_independent.sql`
5. `20261003145000_finance_actuals_known_channel_ceiling.sql`
6. `20261003180000_finance_plan_monthly_basis.sql`
7. `20261003223000_finance_plan_v2_required_sections.sql`

## Operator sequence, when Command Center authorizes staging

1. Verify the target ref with the four checks above. Stop on any miss.
2. Run both queries in `MALFORMED_PLAN_PREFLIGHT.md`.
   - Any `stop-apply` row (version 2) stops the apply. Repair that document with an ordinary admin `UPDATE` first.
   - Any `stop-upgrade-and-open` row (minimal version 1, including `{}` and `{"kept":true}`) does not by itself stop the apply. Those rows stay valid version 1 storage. Stop before anyone runs `finance_upgrade_draft_schema` or `finance_open_draft` on them. Repair with an ordinary admin `UPDATE` to a full section document. There is no replace-invalid-draft button.
3. Take a database backup through the host's backup control and record the backup id. This repository does not store that backup. Do not apply without it.
4. Apply the pending forward migrations with the authorized Supabase workflow, in the order above. Do not hand-edit an applied file. Operators do not run supabase db reset on staging or production.
5. Re-run both preflight queries. Version 2 must return zero rows. Version 1 rows that remain are still a stop for upgrade and open-draft.
6. Post-apply security check, read-only:
   - `finance_plans` and `finance_monthly_actuals` have RLS enabled and forced.
   - `authenticated` has no DELETE grant on either table.
   - anon, owner, manager, and viewer still fail Finance access.
   - `finance_actuals_schema_version` is still version 1 only.
   - one draft per tenant and one approved plan per tenant still hold.
7. Smoke the eight reports, Monthly Check-In, and the three modes with synthetic data only. Do not load real TVG finance data. Read-only report screens must not write.

## Stop and rollback

Stop if the new constraint fails on apply. The rebuild validates every existing `finance_plans` row. A version 2 row that is only `{monthly_basis:{}}`, that uses month `0000-01-01`, or that is missing `structural`, `stages`, `staffing`, `owner_field_replacement`, `cost_pools`, `channels`, or `services` will stop the migration. Version 1 rows are still valid without those sections, as long as they have no `monthly_basis` key. Do not drop the constraint to force the apply through.

A failed migration file rolls back its own transaction. If the database is left partway through the chain, restore the backup from step 3. Do not repair that state with `supabase db reset` on staging or production. Do not delete Finance rows to make the constraint pass.

## TenantGuard on same-tenant navigation

`TenantGuard` re-checks the session and the URL tenant. same-tenant navigation does not re-run the superuser check. A role revoked in the middle of a session is not seen by that client gate until the session or the URL tenant changes. The shell stays mounted so an unsaved Finance edit is not discarded. Server RLS and the finance RPCs still enforce the role on every request. Client-side hiding is not authorization.

## Local proof

On an unlinked local stack only:

```bash
cd command-center
npx supabase db reset --local --yes
```

Then run `supabase/tests/finance/01` through `06` with `psql` against the local URL. Each file begins a transaction and rolls it back. That command is not a staging or production command.
