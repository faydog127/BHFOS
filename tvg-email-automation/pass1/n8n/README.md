# n8n workflows — TVG Email Pass 1

**STAGING ONLY / HOSTINGER OFF**

| File | Trigger in the file | Active | Schedule |
|---|---|---|---|
| `tvg-email-intake-fast-ack.json` | Webhook path `tvg/hostinger-mail/inbound`, Header Auth | `false` | none |
| `tvg-email-intake-worker.json` | Manual only | `false` | none |
| `tvg-email-hostinger-mock.json` | GET test webhooks under `tvg/staging-mock/mail/...` | `false` | none |
| `tvg-email-intake-reconcile.json` | Manual, plus a schedule node | `false` | node `disabled: true` (12 minutes) |
| `tvg-email-daily-filtered-digest.json` | Manual, plus a schedule node | `false` | node `disabled: true` (daily) |
| `tvg-email-notification-dispatcher.json` | Manual only | `false` | none. Twilio node `disabled: true` and not connected |
| `tvg-email-health-heartbeat.json` | Manual, plus a schedule node | `false` | node `disabled: true` (1 minute). No Twilio node |

Every workflow name starts with `[STAGING] `. This pack has no `[PROD]` workflow.

Regenerate JSON with `node tvg-email-automation/pass1/n8n/build-workflows.mjs` after changing `lib/pass1-intake-logic.mjs`, `lib/pass1-internal-sms.mjs`, or `lib/pass1-ops-policy.mjs`.

Import into n8n and leave every workflow inactive. Do not register the webhook with Hostinger. Do not enable the schedule nodes.

Credential name expected after a future staging setup: `TVG Staging n8n_email_automation`. The JSON does not contain a password. Webhook bearer comparison reads `HOSTINGER_WEBHOOK_SECRET` from the n8n environment and fails closed when it is unset. Do not put that secret in git.

The fast ACK path does not call Hostinger. Webhook auth is Header Auth (`Authorization: Bearer`), credential name `TVG Staging Hostinger Webhook Header Auth`. A body that fails pointer checks returns HTTP 400 from `Shape reject` and does not insert `intake_queue`. The worker claims synthetic rows and real pointers while `intake_processing_enabled` is true. Non-synthetic uid `924150001` is excluded from that claim. Real fetch is three GET requests (metadata, text, source) after a host allowlist check. The base URL setting defaults to `disabled`. `api.mail.hostinger.com` also requires `hostinger_live_fetch_enabled=true`. The Hostinger Mail API credential in the JSON is a placeholder name only. The mock workflow does not call Hostinger. See `STAGING_CORRECTIVE_SMOKE_RUNBOOK.md`.

The digest workflow has no send node. It inserts a `notification_log` row on channel `internal_digest` with status `suppressed_pre_webhook` when the digest is not both enabled and destined.

The worker writes notification intent into `notification_log` after a synthetic outcome. That table is the outbox. The worker does not call Twilio. While `internal_sms_enabled` is false, those rows are `recorded_not_sent` with reason `credential_not_approved`. Dedup is `(tenant_id, email_event_id, notification_kind)`. `destination_ref` is the settings value `internal_sms_destination_ref`.

Ordinary SMS text starts with `TVG: New email — review` and ends with `No reply sent by automation.` While `live_notification_started_at` is unset (null, blank, or missing), the worker records the event and does not build a per-message SMS. It may write one `backlog_summary` and no second one. The exact backlog sentence is an implement reading; see the decision register.

The health workflow is inactive. A quiet pending queue is not a fault. One open `health_outage` and one `health_recovery` share an incident key. `health_alerts_enabled` stays false, so a manual run records success without opening an outage. Newer-mail and intake-lag are SQL nulls with `mailbox_probe = dormant`. The workflow does not call Hostinger. That dormant probe is not live enablement.

The Postgres credential name is `TVG Staging n8n_email_automation`. The role password was not set at apply and is not in these JSON files. The approved path is the staging SQL editor, then that n8n credential only.

When ordinary traffic is already at `max_internal_sms_per_hour` (default 10), further ordinary events are suppress-with-log and one storm summary is stored for the UTC hour. HOLD and error still surface as one prioritized SMS each until their own counter hits that cap, then suppress-with-log. The summary count is the number of ordinary events suppressed when that one summary is written.

The dispatcher selects `queued` internal SMS rows whose `dispatch_after` is due, and only when `internal_sms_enabled` is true, then throws `INTERNAL_SMS_CREDENTIAL_NOT_APPROVED` if any row is present. There is no inbound command path. The Twilio node uses placeholder credential name `TVG Internal SMS Twilio`. `to` is `={{ $json.destination_ref }}` from `internal_sms_destination_ref`. `from` is `={{ $json.sms_from_credential_only }}`, which the select leaves null. The node is disabled and disconnected. No phone number is in the JSON. SMS transport is not the system of record.

Resume actor A is `apply/resume_deferred_kill_switch.sql`. Resume actor B is the inactive Reconcile workflow.
