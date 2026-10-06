# Finance maintenance contract

This is the intended write path for `finance_plans` and `finance_monthly_actuals`. It does not change grants, policies, or triggers. Replica mode, trigger disabling, and constraint bypasses are not maintenance tools.

## Who may write

A write is legitimate only when all of these are true:

- The session role is `authenticated`.
- `auth.uid()` is a non-null JWT subject (`request.jwt.claim.sub`).
- `auth.jwt() -> app_metadata ->> tenant_id`, after trim and lower, is `tvg`.
- `auth.jwt() -> app_metadata -> role` is a JSON string, and that string, after trim and lower, is `admin` or `super_admin`.

`finance_plan_access()` is that check. Row policies on both tables require it. `owner`, `manager`, and `viewer` are not writers. A role stored only in `user_metadata` or in the browser is not a writer.

## Where `42501 finance_access_denied` comes from

These functions raise `finance_access_denied` with SQLSTATE `42501` when the session has no `auth.uid()`, or when `finance_plan_access()` is false:

| Function | When |
|---|---|
| `finance_plan_before_insert` | `auth.uid()` is null. Runs before RLS. |
| `finance_actual_before_write` | `auth.uid()` is null, on insert and update. Runs before RLS. |
| `finance_approve_plan` | `finance_plan_access()` is false. |
| `finance_open_draft` | `finance_plan_access()` is false. |
| `finance_upgrade_draft_schema` | `finance_plan_access()` is false. |

A superuser, including the `postgres` role, bypasses row level security even when it is forced. The triggers and the RPCs still run. A `postgres` insert into `finance_plans`, a `postgres` write to `finance_monthly_actuals`, and a `postgres` call to those RPCs therefore return `42501 finance_access_denied`. That denial is the contract. It is not a defect to remove.

`finance_plan_before_update` does not raise `finance_access_denied`. A superuser update of an existing plan row is not rejected by that trigger, because superuser bypasses RLS. That path is not an authorized maintenance write. Do not use it to repair or clean rows.

## How to do legitimate maintenance

Use one transaction, a real admin subject, and the normal SQL or RPC:

```sql
begin;
select set_config('request.jwt.claim.sub', '<admin-user-uuid>', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '<admin-user-uuid>',
    'role', 'authenticated',
    'app_metadata', json_build_object('tenant_id', 'tvg', 'role', 'admin')
  )::text,
  true
);
set local role authenticated;
-- insert, update, or call finance_approve_plan / finance_open_draft / finance_upgrade_draft_schema
commit;
```

Cleanup of synthetic rows uses the same session. Delete is not granted to `authenticated`. If a row must be removed, that is a separate authorized change, not a replica-mode delete. The staging cleanup that set `session_replication_role = replica` is a recorded deviation. Do not copy it.

Do not set `session_replication_role = replica`. Do not disable triggers. Do not drop checks to make a probe succeed.
