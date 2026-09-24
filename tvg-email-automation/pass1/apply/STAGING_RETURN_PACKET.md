# Staging return packet — consolidated Pass 1 directive

**STAGING ONLY / HOSTINGER OFF / PRODUCTION CLOSED**

Branch: `cursor/tvg-email-pass1-v5-3e46`. Draft PR #160. This packet is source plus local evidence. It is not a new staging apply and it is not a production verification.

## What was not done

- The base file `apply/20260924_tvg_email_pass1_v5.sql` was not re-applied. The coordinator reported that apply on `glkrykpksbsqmmilmjhs`. This repo does not contain `staging-apply/APPLY_REPORT.md`, and this session did not re-query that database.
- Hostinger was not activated. No live SMS credential was attached. Production was not mutated. No CRM lead was created. The PR was not merged.
- `internal_sms_enabled` stays false. `health_alerts_enabled` stays false. `live_notification_started_at` stays null.

## Inactive proof

Six workflow JSON files. Each has `active: false`. Schedule nodes that exist are `disabled: true`. Names start with `[STAGING] `. `meta.tvgEmailPass1.credentialScope` is `staging-only`. There is no `[PROD]` workflow.

| File | Role |
|---|---|
| `n8n/tvg-email-intake-fast-ack.json` | Webhook path present, no Hostinger HTTP call |
| `n8n/tvg-email-intake-worker.json` | Synthetic claim only. Writes the outbox. No Twilio node |
| `n8n/tvg-email-intake-reconcile.json` | Schedule disabled |
| `n8n/tvg-email-daily-filtered-digest.json` | Schedule disabled. No send node |
| `n8n/tvg-email-notification-dispatcher.json` | Selects queued outbox rows. Twilio node disabled and disconnected. Guard throws `INTERNAL_SMS_CREDENTIAL_NOT_APPROVED` |
| `n8n/tvg-email-health-heartbeat.json` | Schedule disabled. No Twilio node. Hostinger newer-mail and intake-lag are mock (`mailbox_probe = dormant`). No Hostinger API call. Writes outbox intent and `health_checks` only |

Postgres credential name: `TVG Staging n8n_email_automation`. Twilio placeholder name: `TVG Internal SMS Twilio`. `to` is `={{ $json.destination_ref }}`. `from` is `={{ $json.sms_from_credential_only }}`, which the select leaves null. No phone number, account SID, or auth token is in the JSON.

## Fixtures

| Concern | Where it is proved locally |
|---|---|
| Heartbeat | `test/pass1-ops-policy.test.mjs` (quiet inbox, stale, fail, dep, one outage, dedup, one recovery). Newer-mail and intake-lag stay dormant unless a test explicitly marks the probe live. The workflow JSON does not. `fixtures/sql/local-smoke.sql` asserts two `health_checks` rows, alerts off, and a repeated `health_outage` window rejected |
| Outbox | Worker has no Twilio node. Dispatcher is separate and inactive. Local smoke inserts one `queued` row and requires `dispatch_after` plus `dispatch_attempt_count = 0` |
| Watermark | `test/pass1-internal-sms.test.mjs`. Unset watermark (`null`, blank, or `null` text) is fail-closed: no per-message SMS, and a second call after `backlogSummarySent` writes no further summary. A real watermark with a missing event time is also `record_only`. Local smoke keeps `live_notification_started_at` null and rejects a second backlog row |
| Storm | Existing SMS tests: first overflow `N=1`, amendment example `N=12`, no second summary. Local smoke rejects a repeated storm window |
| Threading | `captureThreadMetadata` returns `in_reply_to` and `references_header` and no `parent_id`. Local smoke stores both headers |
| Attachments | `assertAttachmentMetadataOnly` rejects `bytes`. SQL check `email_events_attachment_metadata_only` rejects a `bytes` key. Local smoke covers that rejection |
| Timing | Constants 120 and 900 seconds. Settings `primary_path_target_seconds`, `reconcile_target_seconds`, and null `notification_quiet_hours` asserted in local smoke |
| Wording | Ordinary SMS contains `review` and `No reply sent by automation.` Workflow JSON must not contain `needs response` |

## Credentials and customer send

- No production credential material. The forbidden production ref may appear only as the guard label `productionRefForbidden`.
- No customer-send tables. The incremental latch refuses to run if `email_responses` or `email_send_queue` exist.
- No customer SMS channel. The trigger rejects `customer_sms`.
- No inbound SMS command node.
- The `n8n_email_automation` password was not set at the reported apply. This pack does not set it. Approved path: an operator runs `ALTER ROLE n8n_email_automation PASSWORD ...` in the staging SQL editor for `glkrykpksbsqmmilmjhs` only, then stores that secret only in the n8n credential `TVG Staging n8n_email_automation`. The password is not written to git, workflow JSON, SQL files, settings, or logs.

## Challenge PASS notes

1. Heartbeat Hostinger newer-mail / intake-lag checks are mock and dormant until Pre-webhook. They are not live Hostinger API health probing.
2. Unset `live_notification_started_at` means no per-message SMS and at most one backlog summary.
3. Decision register is required now: [`../TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](../TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md).
4. Role password path is the staging SQL editor plus the n8n credential, never git.
5. Pre-webhook still owns form-filter ordering and open-lead production evidence. Those are not staging blockers.

## Decision register

[`../TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](../TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md)

## CLOSED / OPEN / DECISION_REQUIRED

CLOSED: design loop, Pre-webhook gate (not passed), production, staging proceed, SMS amendment, CRM lead create deferred, Hostinger off, customer SMS off, one-way SMS, attachment metadata only, thread metadata only, quiet inbox is not a fault, git as implementation system of record, review wording, 120s / 900s / 24/7, `notification_log` as the outbox.

OPEN (gate stays closed): form/filter field lock, production open-lead census, real Hostinger auth sample, carrier readiness, Founder SMS credential, A2P 10DLC versus toll-free, cost, CRM lead-gap since 2024-07-24 before production reliance, production security hardening.

DECISION_REQUIRED:

1. The exact backlog summary sentence. The sentence in code is an implement reading.
2. Retention of excerpts and attachment metadata before any retention job.

## Next staging command

Do not re-run the base file. After confirming the URL is `glkrykpksbsqmmilmjhs`:

```bash
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -1 \
  -c "SELECT set_config('tvg_email_pass1.target_project', 'glkrykpksbsqmmilmjhs', false);" \
  -f tvg-email-automation/pass1/apply/20260924_tvg_email_pass1_incremental.sql
```

Then import the six n8n JSON files and leave them inactive. Do not attach a Twilio credential. Do not enable schedules. Do not create the Hostinger webhook.
