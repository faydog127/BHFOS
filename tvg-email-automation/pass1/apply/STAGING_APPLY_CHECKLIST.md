# Staging apply checklist — TVG Email Pass 1

**STAGING ONLY / HOSTINGER OFF**

Apply target: Supabase project `glkrykpksbsqmmilmjhs`  
(name at audit: **BHFOS n8n Assurance Preview**, the TVG CRM Staging / Assurance Preview project).

Forbidden target: `wwyxohjnyqnegzbxtuxs`.

This checklist is not an apply record.

The coordinator applied `apply/20260924_tvg_email_pass1_v5.sql` on `glkrykpksbsqmmilmjhs` on 2026-09-24. That evidence is [`../staging-apply/APPLY_REPORT.md`](../staging-apply/APPLY_REPORT.md). This slice did not re-query staging and did not re-apply the base file. The incremental file remains `apply/20260924_tvg_email_pass1_incremental.sql`. The 2026-09-25 corrective file is additional and is not a substitute for it.

The 2026-09-24 read-only audit below predates that reported apply. It is historical evidence, not the current staging catalog.

## Repo-only vs live apply

| Artifact | Where it lives | Live action |
|---|---|---|
| `apply/20260924_tvg_email_pass1_v5.sql` | Git | Coordinator reported this applied. Do not re-apply it |
| `apply/20260924_tvg_email_pass1_incremental.sql` | Git | Live SQL on `glkrykpksbsqmmilmjhs` only, if that file is not already applied. Refuses to run unless the base tables exist |
| `apply/20260925_tvg_email_pass1_corrective_fetch.sql` | Git | Additional staging settings for the corrective fetch slice. Defaults the Hostinger base URL to `disabled`. Does not reset a key that already exists |
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

## Incremental apply (next live SQL)

1. Confirm the connection is `db.glkrykpksbsqmmilmjhs.supabase.co` (or the Supabase MCP `project_id` `glkrykpksbsqmmilmjhs`). Stop if the ref is `wwyxohjnyqnegzbxtuxs`.
2. Do not run `apply/20260924_tvg_email_pass1_v5.sql` again.
3. In one transaction:

```bash
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -1 \
  -c "SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);" \
  -f tvg-email-automation/pass1/apply/20260924_tvg_email_pass1_incremental.sql
```

The file refuses to run without the latch, without `email_automation.notification_log` and `email_automation.email_events`, or if `email_responses` / `email_send_queue` exist.

4. After that apply, expect:
   - `live_notification_started_at` is JSON null
   - `health_alerts_enabled` is `false`
   - `primary_path_target_seconds` is `120`
   - `reconcile_target_seconds` is `900`
   - `notification_quiet_hours` is JSON null
   - `email_events.in_reply_to` and `email_events.references_header` exist
   - `email_automation.health_checks` has `primary_path` and `reconcile`, status `unstarted`
   - `notification_log.dispatch_after` exists
   - `internal_sms_enabled` is still `false`
   - `after_hours_ack_enabled` is `false` and `auto_send_enabled` is still `false`
   - every `notification_subscriptions.destination_ref` is `founder_mobile_ref`
5. Import the six n8n JSON files only after the incremental apply. The worker reads `live_notification_started_at`. Confirm each workflow is inactive, names start with `[STAGING] `, and schedule nodes are disabled. Confirm `Twilio send disabled` is disabled, disconnected, and uses credential name `TVG Internal SMS Twilio` with no account SID and no auth token. Do not activate them. Do not create a Hostinger webhook. Do not attach a real SMS credential.

Return packet: [`STAGING_RETURN_PACKET.md`](STAGING_RETURN_PACKET.md). Decision register: [`../decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](../decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md). Directive: [`../directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md`](../directives/CC_DIRECTIVE_PASS1_STAGING_CONSOLIDATED_2026-09-24.md).

## Corrective fetch settings (2026-09-25)

Apply this only after the base pack is present. Apply the incremental file first if it has not been applied. Do not re-apply the base file.

```bash
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -1 \
  -c "SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);" \
  -f tvg-email-automation/pass1/apply/20260925_tvg_email_pass1_corrective_fetch.sql
```

Expect `hostinger_mail_api_base_url` = JSON string `disabled`, `hostinger_live_fetch_enabled` = false, and `hostinger_fetch_excluded_uids` containing `924150001`. Re-applying this file does not overwrite a key that already exists. Manual smoke steps are in [`../STAGING_CORRECTIVE_SMOKE_RUNBOOK.md`](../STAGING_CORRECTIVE_SMOKE_RUNBOOK.md). Do not activate n8n workflows. Do not register a Hostinger webhook.

## Base apply (already reported — do not repeat)

1. Confirm the connection is `db.glkrykpksbsqmmilmjhs.supabase.co`. Stop if the ref is `wwyxohjnyqnegzbxtuxs`.
2. The historical pre-apply audit expected the email schema to be absent. That expectation is stale after the reported base apply.
3. The base command, kept here so it is not confused with the incremental file:

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
5. The reported apply did not set the `n8n_email_automation` password, and this pack does not set it. Approved path only: `ALTER ROLE n8n_email_automation PASSWORD ...` in the staging SQL editor for `glkrykpksbsqmmilmjhs`, then the same secret in the n8n credential `TVG Staging n8n_email_automation`. Never put that password in git, workflow JSON, SQL files, settings, or logs. Do not use `service_role` in the workflows.
6. Do not add `email_automation` to the Data API exposed schemas.
7. Import is specified in the incremental section above. Six JSON files, not five. Leave them inactive.

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
- The `n8n_email_automation` password was not set at apply. The approved path is the staging SQL editor plus the n8n credential named `TVG Staging n8n_email_automation`. It must not be committed.
- Pre-webhook stays closed after apply. Apply does not authorize Hostinger.
