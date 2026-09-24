# Staging apply checklist — TVG Email Pass 1

**STAGING ONLY / HOSTINGER OFF**

Apply target: Supabase project `glkrykpksbsqmmilmjhs`  
(name at audit: **BHFOS n8n Assurance Preview**, the TVG CRM Staging / Assurance Preview project).

Forbidden target: `wwyxohjnyqnegzbxtuxs`.

This checklist is not an apply record. Nothing in this change was executed against that database except read-only `SELECT`s on 2026-09-24.

## Repo-only vs live apply

| Artifact | Where it lives | Live action |
|---|---|---|
| `apply/20260924_tvg_email_pass1_v5.sql` | Git | Coordinator runs it on `glkrykpksbsqmmilmjhs` only |
| `apply/pre_apply_audit.sql`, `apply/post_apply_smoke.sql` | Git | Read-only SQL on that same project |
| `apply/resume_deferred_kill_switch.sql` | Git | Later ops SQL (resume actor A). Not part of DDL apply |
| n8n JSON under `n8n/` | Git | Import into n8n later, leave **inactive**. Not a Supabase migration. The Twilio node stays disabled and disconnected |
| `design/`, tests, fixture runner | Git | No database |

Do not copy the apply file into `command-center/supabase/migrations` or `supabase/migrations`. Those trees are not this staging project and must not carry this DDL toward production.

## Read-only staging audit (2026-09-24)

Evidence tier: **staging read**. Not an apply. Not production.

- Postgres 17.6. Database name `postgres`.
- `public.contacts` and `public.leads` exist. `id` is uuid. `tenant_id`, `email`, `phone` exist. `leads.status` is text. `leads.contact_id` is uuid.
- RLS is already enabled on both. Policies present: `contacts_authenticated_all`, `leads_authenticated_all` (`authenticated`, `ALL`). Adding `n8n_*` SELECT policies does not newly turn RLS on.
- Counts: 1 contact `tenant_id=tvg`, 1 lead `tenant_id=tvg` with status `Customer`. No phone unique index.
- `public.network_os_assurance_delivery_claims` exists, RLS on, **FORCE** RLS, 10 columns (`delivery_id`, `received_at`, `event_name`, `repository_id`, `installation_id`, `pr_number`, `head_sha`, `forward_state`, `forward_updated_at`, `expires_at`).
- Schemas `email_automation` and `integrations` are absent. Role `n8n_email_automation` is absent. Pass 2 tables are absent.
- `pgcrypto` and `pg_cron` are already installed. This pack does not enable pg_cron jobs.
- `PUBLIC` has `CONNECT` on the database.
- Do not re-baseline CRM. Do not copy production secrets. Do not rename the Supabase project in this pack.

## Apply steps

1. Confirm the connection is `db.glkrykpksbsqmmilmjhs.supabase.co` (or the Supabase MCP `project_id` `glkrykpksbsqmmilmjhs`). Stop if the ref is `wwyxohjnyqnegzbxtuxs`.
2. Run `apply/pre_apply_audit.sql`. Expect contacts/leads present, claims table present, email schema absent.
3. In that same session, set the operator latch and apply in **one transaction**:

```bash
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -1 \
  -c "SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);" \
  -f tvg-email-automation/pass1/apply/20260924_tvg_email_pass1_v5.sql
```

The SQL file refuses to run without the latch. The latch is not proof of the project ref. The URL is.

Supabase MCP equivalent, only if the caller sets `project_id` to `glkrykpksbsqmmilmjhs`: run the `set_config` statement and the apply file in one migration on that project. Do not use `apply_migration` against any other project id.

4. Run `apply/post_apply_smoke.sql`. Expect:
   - role `n8n_email_automation` exists
   - `email_responses` and `email_send_queue` are null
   - `auto_send_enabled` is `false`
   - `hold_on_form_auth_failure` is `true`
   - `known_form_senders` count is 0
   - `n8n_contacts_tvg_select` and `n8n_leads_tvg_select` exist
   - `claim_intake_batch` exists
   - claims force-RLS is still true and the column count is still 10
   - `max_internal_sms_per_hour` is `10`
   - `internal_sms_enabled` is `false`
   - `internal_sms_destination_ref` is `founder_mobile_ref`
   - index `uq_notification_log_event_kind` exists
5. Set the role password **outside git** (`ALTER ROLE n8n_email_automation PASSWORD ...` in the staging SQL editor). Store it only in n8n credentials for staging. Do not use `service_role` in the workflows.
6. Do not add `email_automation` to the Data API exposed schemas.
7. Import the five n8n JSON files. Confirm each workflow shows inactive and the schedule nodes are disabled. Confirm `Twilio send disabled` is disabled, disconnected, and uses credential name `TVG Internal SMS Twilio` with no account SID and no auth token. Do not activate them. Do not create a Hostinger webhook. Do not attach a real SMS credential.

## Resume actor while schedules stay inactive

`deferred_kill_switch` rows are resumed only by [`resume_deferred_kill_switch.sql`](resume_deferred_kill_switch.sql) (actor A), and only when `intake_processing_enabled` is true. The Reconcile workflow contains the same statement (actor B) but its schedule node is disabled and the workflow is inactive, so actor B does not run. Neither actor clears `held` or `error` rows. Neither actor edits Hostinger.

## Pre-webhook blockers from the internal SMS amendment

These block Pre-webhook. They do not block applying the schema with `internal_sms_enabled` left false.

- Carrier readiness: sending number identified, U.S. registration confirmed (A2P 10DLC or verified toll-free — Founder chooses), use case allows internal operational alerts, one real test SMS to a Founder-approved phone with delivery evidence, and delivery failure logged rather than treated as success.
- Founder approval before any real internal-alert SMS credential is attached. At attach time, confirm the Twilio key or subaccount cannot send unrestricted customer SMS (dedicated subaccount or restricted API key; no customer messaging service; no production customer number pool). Secrets stay in n8n credentials. They do not go in workflow JSON, SQL settings, logs, or this repo.
- Destination is the Founder-approved settings value `internal_sms_destination_ref` only. The inactive Twilio node reads that value with an expression. The workflow JSON has no phone number.
- SMS transport is not the system of record. `notification_log` is the record. Pass 1 delivery channel is `internal_sms`. The column mapping to the design `kind` enum and `review_notify_*` settings is in [`../NOTIFICATION_MODEL.md`](../NOTIFICATION_MODEL.md).
- At `max_internal_sms_per_hour`, further ordinary events are suppress-with-log plus one storm summary. HOLD and error still send as one prioritized SMS each until their own counter hits the same cap, then suppress-with-log. Summary count `N` is the suppressed ordinary count at the moment that one summary is stored.
- Founder-only decisions left open: credential provision, A2P 10DLC versus verified toll-free, and cost. The mobile number stays out of git.

See [`../PRE_WEBHOOK_OPEN_ITEMS.md`](../PRE_WEBHOOK_OPEN_ITEMS.md).

## Blockers before live apply

- A person with the staging database role must run the file. This change does not.
- Section A of the design gate is not signed inside `design/09-staging-safety-gate.md`. Command Center authorized the contained staging build; the signature block in that gate file is still blank.
- n8n is not imported by this change. There is no n8n API call in the repo.
- Role password must be chosen by the operator and kept out of git.
- Pre-webhook stays closed after apply. Apply does not authorize Hostinger.
