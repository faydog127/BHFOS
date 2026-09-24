# Notification model mapping — Pass 1 internal SMS

**STAGING ONLY / HOSTINGER OFF**

There is one notification table in this pack: `email_automation.notification_log` from `design/02-email-automation-schema.sql`. Command Center SQL has no `notification_log`. The 2026-09-24 read-only staging audit found schema `email_automation` absent on `glkrykpksbsqmmilmjhs`, so this mapping is against the design model in this repo, not a second live CRM table.

`review_notify_enabled` and `review_notify_destination` stay the design settings for a future internal email or Slack notify (`design/06-n8n-intake-worker-reconcile.md` §7). They are not the SMS phone. Both stay false / null. Internal SMS uses `internal_sms_enabled` and `internal_sms_destination_ref` on the same `automation_settings` table.

## Same table, added columns

| Design shape | SMS amendment |
|---|---|
| `kind` enum `notification_kind` (`hold_alert`, `error_alert`, `daily_filtered_digest`, `stale_intake_hold`, `auth_reject_sample`) | Same enum. Labels `actionable_inbound`, `storm_summary`, `backlog_summary`, `health_outage`, and `health_recovery` are added. Text column `notification_kind` must equal `kind::text`. The dedup index uses the text column. |
| `destination_ref` | Same column. Channel `internal_sms` stores the Founder-approved settings label from `internal_sms_destination_ref` (`founder_mobile_ref`). A phone number is rejected. |
| `status` | Same column. SMS writes set `status` and `delivery_state` to the same token. |
| `error_message` | Same column. Reserved for a later provider failure. |
| `sent_at` | Same column. `attempted_at` is set even when the row is recorded and not sent. |
| `email_event_id`, `intake_queue_id`, `payload_summary`, `tenant_id='tvg'` | Unchanged. Dedup is `(tenant_id, email_event_id, notification_kind)`. |

Suppression is columns on this table (`suppression_state`, `suppression_reason`, `suppression_window`), plus `channel`, `provider_message_id`, `delivery_state`, and `attempted_at`. There is no second log.

## Kind mapping for SMS

| Intake status | `kind` / `notification_kind` | Channel |
|---|---|---|
| `awaiting_pass2` | `actionable_inbound` | `internal_sms` |
| `held`, including `stale_processing` | `hold_alert` | `internal_sms` |
| material `error` | `error_alert` | `internal_sms` |
| ordinary storm overflow | `storm_summary` | `internal_sms` |
| pre-live backlog, at most one | `backlog_summary` | `internal_sms` |
| heartbeat outage / recovery | `health_outage` / `health_recovery` | `internal_sms` |
| filtered digest audit | `daily_filtered_digest` | `internal_digest` |

`notification_log` is the durable outbox. The worker inserts intent. `dispatch_after`, `dispatched_at`, and `dispatch_attempt_count` belong to the inactive dispatcher. The worker does not send SMS.

The 2026-09-24 operator-preference addendum adds `notification_recipients` and `notification_subscriptions`. Pass 1 seeds one recipient, `founder`, one channel, `internal_sms`, and one destination, `founder_mobile_ref`, until the Founder authorizes more recipients. Subscription `enabled` stays false. `escalation_after` stays null. `after_hours_ack_enabled` stays false and does not turn on `auto_send_enabled`. A change to `automation_settings` or a subscription writes `configuration_audit` with actor, timestamp, setting, previous value, and new value.

`stale_intake_hold` stays on the enum for a future `review_notify` email or Slack row. This pack does not insert that kind for the SMS channel. A held event gets one `hold_alert` row.

`review_notify_destination` is not copied into `destination_ref` for SMS. The workflow `to` expression reads `internal_sms_destination_ref` at run time. The phone number is not stored in workflow JSON, SQL settings, or `notification_log`.
