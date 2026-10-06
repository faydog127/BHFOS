# Superuser edit-guard analysis

This is a permission analysis. It does not add a guard and it does not change grants. Hosted role attributes were not read.

## Who can edit

A normal write requires `authenticated`, a non-null `auth.uid()`, tenant `tvg` in `app_metadata`, and role `admin` or `super_admin`. That is `finance_plan_access()`. Policies on `finance_plans` and `finance_monthly_actuals` require it for select, insert, and update. There is no delete grant. `owner`, `manager`, and `viewer` are not writers. `anon` and `service_role` have no table grant and no execute grant on the finance triggers.

Both tables use `FORCE ROW LEVEL SECURITY`. A table owner does not bypass those policies. A role bypasses them only when it is superuser or has `BYPASSRLS` (`rolbypassrls`).

On this branch the hosted attributes of `postgres`, `supabase_admin`, and the migration role are UNKNOWN. Do not treat a local superuser as the hosted role.

## What the update trigger stops

`finance_plan_before_update` in `20261006142000` runs for every update, including a superuser update, unless the trigger is disabled or replica mode is set. Those two escapes are prohibited.

Without `finance.plan_transition`:

- A draft stays a draft. Inputs may change. Version increments.
- An approved or superseded row raises `finance_plan_locked`. Status and inputs stay. This holds for a superuser who bypasses RLS, because the trigger does not consult RLS.

With `finance.plan_transition = approve`:

- Approved to superseded freezes inputs and notes.
- Draft to approved runs `finance_plan_approvable(old.inputs)` and freezes inputs. A total of exactly 1, a blank hurdle, and the other contract failures raise `finance_plan_not_approvable` before the status change.
- Any other status pair raises `finance_invalid_transition`.

Insert of a plan forces `draft` and raises `finance_access_denied` when `auth.uid()` is null. The approve, open-draft, and upgrade RPCs raise the same denial when `finance_plan_access()` is false. A `postgres` session with no JWT cannot insert a plan, write an actual, or call those RPCs.

## What it does not stop

- A bypassrls or superuser session can update a draft with no JWT. The trigger does not check `auth.uid()`. `updated_by_user_id` becomes null.
- That same session can set `finance.plan_transition = approve` and approve a document that passes the contract, with `approved_by` null.
- It can set `finance.plan_transition = schema_upgrade` and upgrade a version 1 draft.
- It can disable the trigger or set `session_replication_role = replica`. The trigger cannot stop its own disablement.
- Hosted `pg_graphql`, if enabled, uses the same grants, RLS, and trigger. Whether it is enabled is UNKNOWN.

`finance_approve_plan` does not clear the GUC after a successful approve. The trigger still re-checks approvability on a later draft-to-approved update in that transaction.

## Risk

The open gap is not approved-row editing. The trigger already refuses that for every role that cannot disable it. The gap is a bypassrls role editing drafts and approving a valid draft without an admin JWT, plus the unknown possibility that hosted `postgres` is that role. Client-side hiding does not close it.

## Recommended disposition

Hold a new `auth.uid()` guard until an authorized operator snapshots `rolsuper` and `rolbypassrls` for `postgres`, `supabase_admin`, and the migration role on the hosted project. This packet does not add the guard, because those attributes are UNKNOWN and a guessed guard would be an unreviewed write-path change.

After that snapshot:

- If none of those roles bypass RLS, record that and leave the trigger as it is. Gate S still needs the rest of the hosted proof.
- If any of them bypass RLS, the next authorized migration should make `finance_plan_before_update` raise `finance_access_denied` when `auth.uid()` is null, for draft edits and for the approve and schema-upgrade transitions. Do not ship that change before the snapshot.

Until then, superuser draft edits and GUC approval are prohibited operator actions, not a maintenance path. Do not use them to repair rows.
