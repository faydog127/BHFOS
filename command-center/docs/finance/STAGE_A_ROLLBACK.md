# Stage A finance rollback (local only)

This rollback drops the Stage A finance tables and functions. It does not touch `enforce_tenant_id_immutability()`.

Do not run this against a linked, staging, or production database. Production project `wwyxohjnyqnegzbxtuxs` and staging project `glkrykpksbsqmmilmjhs` are out of scope. There is no finance seed to restore.

Apply on a local stack only, after `npx supabase start` and `npx supabase db reset` from `command-center/`:

```sql
begin;
drop function if exists public.finance_approve_plan(uuid, integer);
drop function if exists public.finance_open_draft(uuid);
drop table if exists public.finance_monthly_actuals;
drop table if exists public.finance_plans;
drop function if exists public.finance_actual_before_write();
drop function if exists public.finance_plan_before_update();
drop function if exists public.finance_plan_before_insert();
drop function if exists public.finance_plan_access();
commit;
```

Confirm both tables are gone, then restore the local schema with another `npx supabase db reset`. That reset reapplies the forward migration. It is not a remote migration.
