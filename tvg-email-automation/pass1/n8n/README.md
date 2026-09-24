# n8n workflows — TVG Email Pass 1

**STAGING ONLY / HOSTINGER OFF**

| File | Trigger in the file | Active | Schedule |
|---|---|---|---|
| `tvg-email-intake-fast-ack.json` | Webhook path `tvg/hostinger-mail/inbound` | `false` | none |
| `tvg-email-intake-worker.json` | Manual only | `false` | none |
| `tvg-email-intake-reconcile.json` | Manual, plus a schedule node | `false` | node `disabled: true` (12 minutes) |
| `tvg-email-daily-filtered-digest.json` | Manual, plus a schedule node | `false` | node `disabled: true` (daily) |
| `tvg-email-internal-sms-delivery.json` | Manual only | `false` | none. Twilio node `disabled: true` and not connected |

Regenerate JSON with `node tvg-email-automation/pass1/n8n/build-workflows.mjs` after changing `lib/pass1-intake-logic.mjs` or `lib/pass1-internal-sms.mjs`.

Import into n8n and leave every workflow inactive. Do not register the webhook with Hostinger. Do not enable the schedule nodes.

Credential name expected after a future staging setup: `TVG Staging n8n_email_automation`. The JSON does not contain a password. Webhook bearer comparison reads `HOSTINGER_WEBHOOK_SECRET` from the n8n environment and fails closed when it is unset. Do not put that secret in git.

The fast ACK path does not call Hostinger. The worker claims only `intake_queue` rows whose `hostinger_pointers` contain `synthetic_message`, and only while `intake_processing_enabled` is true. There is no HTTP Request node.

The digest workflow has no send node. It inserts a `notification_log` row on channel `internal_digest` with status `suppressed_pre_webhook` when the digest is not both enabled and destined.

The worker plans internal SMS after a synthetic outcome and inserts `notification_log` rows. It does not call Twilio. While `internal_sms_enabled` is false, those rows are `recorded_not_sent` with reason `credential_not_approved`. Dedup is `(tenant_id, email_event_id, notification_kind)`. Ordinary actionable-inbound texts and priority HOLD/error texts each stop at `max_internal_sms_per_hour` (default 10). One storm summary is stored per UTC hour.

The delivery workflow selects `queued` internal SMS rows only when `internal_sms_enabled` is true, then throws `INTERNAL_SMS_CREDENTIAL_NOT_APPROVED` if any row is present. The Twilio node uses placeholder credential name `TVG Internal SMS Twilio`, `to` `FOUNDER_APPROVED_MOBILE_NOT_IN_REPO`, and `from` `INTERNAL_ALERT_FROM_NOT_IN_REPO`. It is disabled and disconnected. SMS transport is not the system of record.

Resume actor A is `apply/resume_deferred_kill_switch.sql`. Resume actor B is the inactive Reconcile workflow.
