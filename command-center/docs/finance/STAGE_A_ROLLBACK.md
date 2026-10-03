# Stage A finance rollback (local only)

This rollback drops the Stage A finance tables and functions. It does not touch `enforce_tenant_id_immutability()`.

Do not run this against a linked, staging, or production database. Production project `wwyxohjnyqnegzbxtuxs` and staging project `glkrykpksbsqmmilmjhs` are out of scope. There is no finance seed to restore.

No real TVG data may be entered in any Vercel Preview or staging environment. The finance migration is not applied to any remote project by PR #164. Preview must use a non-production Supabase project, or none. Applying the migration anywhere requires explicit Command Center authorization.

`finance.plan_transition` is a transaction-local setting used only inside `finance_approve_plan`. It is not an API column. Direct SQL in that same session can set it. The app approves through `finance_approve_plan`.

Trigger functions are executable by `authenticated` because PostgreSQL requires that privilege to fire the trigger. `PUBLIC` and `anon` do not have it.

JWT tenant comparison is `lower(btrim(tenant_id)) = 'tvg'`, the same lower-and-trim rule as the client guard. The stored `tenant_id` column remains exactly `tvg`. SQL `btrim` removes spaces. The client trim also removes other leading and trailing whitespace, so a non-space pad is denied by the database.

One draft per tenant is `finance_plans_one_draft`, a partial unique index on `finance_plans (tenant_id)` where `status = 'draft'`. `finance_open_draft` returns that existing draft. Dropping `finance_plans` drops the index. To remove only that rule on a local stack: `drop index if exists public.finance_plans_one_draft;`

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
