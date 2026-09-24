# Founder operator-preference addendum — 2026-09-24

**STAGING ONLY / HOSTINGER OFF / PRODUCTION CLOSED**

Founder-approved. The design loop stays closed. This note records the addendum that was given to the staging pack. It does not change Decision IDs TVG-EMAIL-P1-D001 through D022 or their statuses in [`TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md).

## Decision IDs

The coordinator is writing Decision IDs for addendum items 1–6. Item 6 is OPEN. Those IDs were not under `uploads/` or `decision-register/` when this note was committed. They are not invented here. No follow-up cadence default is invented here.

When the coordinator file arrives, commit it beside this note and do not rewrite the statuses already in the register.

## Challenge PASS notes folded

1. Pass 1 has one Founder destination, `founder_mobile_ref`, until the Founder authorizes more recipients.
2. Quiet hours, urgency detection, draft review, and reply voice are not implemented in Pass 1. They stay Pass 2 inputs.
3. Urgent candidates stay in the Decision Register or design notes. Pass 1 has no keyword rules. No candidate list was supplied, so none is stored.
4. After-hours acknowledgement stays disabled (`after_hours_ack_enabled` false). That is not permission for general auto-send. `auto_send_enabled` stays false.

## Pass 1 boundary that this pack implements

- Internal notification recipient and configuration model. The live shape is one Founder destination on internal SMS. Columns exist for a later recipient, channel, subscription, and escalation, and the checks reject every other combination.
- Configuration changes are auditable: actor, timestamp, setting, previous value, new value.
- No free-text urgency keyword classification.
- No Pass 2 draft review UI, no after-hours customer acknowledgement, and no follow-up cadence.

`escalation_after` stays null. `notification_subscriptions.enabled` stays false while `internal_sms_enabled` stays false.

## Pass 2 design inputs — not built

See [`../PASS2_DESIGN_INPUTS.md`](../PASS2_DESIGN_INPUTS.md).
