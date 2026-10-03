# Stage A finance rollback (local only)

This rollback drops the Stage A finance tables and functions. It does not touch `enforce_tenant_id_immutability()`.

Do not run this against a linked, staging, or production database. Production project `wwyxohjnyqnegzbxtuxs` and staging project `glkrykpksbsqmmilmjhs` are out of scope. There is no finance seed to restore.

No real TVG data may be entered in any Vercel Preview or staging environment. The finance migration is not applied to any remote project by PR #164. Preview must use a non-production Supabase project, or none. Applying the migration anywhere requires explicit Command Center authorization.

`finance.plan_transition` is a transaction-local setting used only inside `finance_approve_plan`. It is not an API column. Direct SQL in that same session can set it. The app approves through `finance_approve_plan`.

Trigger functions are executable by `authenticated` because PostgreSQL requires that privilege to fire the trigger. `PUBLIC` and `anon` do not have it.

JWT tenant comparison is `lower(btrim(tenant_id)) = 'tvg'`, the same lower-and-trim rule as the client guard. The stored `tenant_id` column remains exactly `tvg`. SQL `btrim` removes spaces. The client trim also removes other leading and trailing whitespace, so a non-space pad is denied by the database.

One draft per tenant is `finance_plans_one_draft`, a partial unique index on `finance_plans (tenant_id)` where `status = 'draft'`. `finance_open_draft` returns that existing draft. Dropping `finance_plans` drops the index. To remove only that rule on a local stack: `drop index if exists public.finance_plans_one_draft;`

Monthly actuals are one row per `tenant_id` and `month`. `comparison_plan_id` is a nullable comparison basis. The migration `20261003132212_finance_actuals_plan_independent.sql` renames the old plan column only when the actuals table is empty. No remote database has this table, and there is no finance seed, so there are no stored facts to copy or preserve. Dropping `finance_monthly_actuals` drops that shape with the table.

Total Revenue is earned operating revenue for work completed in the reporting month. It is not invoice issue-date volume, cash collected, quoted value, or scheduled value. Channel revenue uses the same basis. AR and cash stay separate. `source` allows only manual entry.

`20261003145000_finance_actuals_known_channel_ceiling.sql` replaces `finance_actuals_channel_reconcile`. Known non-null channel amounts cannot exceed Total Revenue. When all three channels are present they must equal Total Revenue, and Total Revenue is required. A null channel is not stored as zero. The check expression uses zero only to add the known amounts. Dropping `finance_monthly_actuals` drops that constraint with the table.

`jobs` / `job_operational_state_v1` are the operational starting point for completed work. Appointments are scheduling records. Business Analytics is not Finance revenue authority.

Apply on a local stack only, after `npx supabase start` and `npx supabase db reset` from `command-center/`:

```sql
begin;
drop function if exists public.finance_approve_plan(uuid, integer);
drop function if exists public.finance_open_draft(uuid);
drop index if exists public.finance_plans_one_draft;
drop table if exists public.finance_monthly_actuals;
drop table if exists public.finance_plans;
drop function if exists public.finance_actual_before_write();
drop function if exists public.finance_plan_before_update();
drop function if exists public.finance_plan_before_insert();
drop function if exists public.finance_plan_access();
commit;
```

Confirm both tables are gone, then restore the local schema with another `npx supabase db reset`. That reset reapplies the forward migration. It is not a remote migration.
