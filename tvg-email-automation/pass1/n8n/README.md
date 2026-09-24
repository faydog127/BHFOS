# n8n workflows — TVG Email Pass 1

**STAGING ONLY / HOSTINGER OFF**

| File | Trigger in the file | Active | Schedule |
|---|---|---|---|
| `tvg-email-intake-fast-ack.json` | Webhook path `tvg/hostinger-mail/inbound` | `false` | none |
| `tvg-email-intake-worker.json` | Manual only | `false` | none |
| `tvg-email-intake-reconcile.json` | Manual, plus a schedule node | `false` | node `disabled: true` (12 minutes) |
| `tvg-email-daily-filtered-digest.json` | Manual, plus a schedule node | `false` | node `disabled: true` (daily) |

Regenerate JSON with `node tvg-email-automation/pass1/n8n/build-workflows.mjs` after changing `lib/pass1-intake-logic.mjs`.

Import into n8n and leave every workflow inactive. Do not register the webhook with Hostinger. Do not enable the schedule nodes.

Credential name expected after a future staging setup: `TVG Staging n8n_email_automation`. The JSON does not contain a password. Webhook bearer comparison reads `HOSTINGER_WEBHOOK_SECRET` from the n8n environment and fails closed when it is unset. Do not put that secret in git.

The fast ACK path does not call Hostinger. The worker claims only `intake_queue` rows whose `hostinger_pointers` contain `synthetic_message`, and only while `intake_processing_enabled` is true. There is no HTTP Request node.

The digest workflow has no send node. It inserts a `notification_log` row with status `suppressed_pre_webhook` when the digest is not both enabled and destined.

Resume actor A is `apply/resume_deferred_kill_switch.sql`. Resume actor B is the inactive Reconcile workflow.
