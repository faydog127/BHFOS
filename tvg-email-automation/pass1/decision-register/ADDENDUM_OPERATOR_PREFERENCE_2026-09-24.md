# Founder operator-preference addendum — 2026-09-24

**STAGING ONLY / HOSTINGER OFF / PRODUCTION CLOSED**

Founder-approved. The design loop stays closed. This note records the addendum that was given to the staging pack. It does not change Decision IDs TVG-EMAIL-P1-D001 through D022 or their statuses in [`TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md).

## Decision IDs

The coordinator files are now in the pack and were copied without status edits:

- Addendum: [`../directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md`](../directives/CC_ADDENDUM_FOUNDER_OPERATOR_PREFERENCES_2026-09-24.md)
- Register rows TVG-EMAIL-P1-D023 through D028 in [`TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`](TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md)

Recorded statuses, unchanged by this pack: D023 Active; D024 Recommendation; D025 Recommendation; D026 Recommendation; D027 Recommendation; D028 Open / Proposed. No follow-up cadence default is stored.

## Challenge PASS notes folded

1. Pass 1 has one Founder destination, `founder_mobile_ref`, until the Founder authorizes more recipients.
2. Quiet hours, urgency detection, draft review, and reply voice are not implemented in Pass 1. They stay Pass 2 inputs.
3. Urgent candidates are recorded only in TVG-EMAIL-P1-D026: property management, commercial, and fire/smoke/CO/burning-smell. Pass 1 has no keyword rules and no emergency acknowledgement language.
4. After-hours acknowledgement stays disabled (`after_hours_ack_enabled` false). That is not permission for general auto-send. `auto_send_enabled` stays false.

## Pass 1 boundary that this pack implements

- Internal notification recipient and configuration model. The live shape is one Founder destination on internal SMS. Columns exist for a later recipient, channel, subscription, and escalation, and the checks reject every other combination.
- Configuration changes are auditable: actor, timestamp, setting, previous value, new value.
- No free-text urgency keyword classification.
- No Pass 2 draft review UI, no after-hours customer acknowledgement, and no follow-up cadence.

`escalation_after` stays null. `notification_subscriptions.enabled` stays false while `internal_sms_enabled` stays false.

## Pass 2 design inputs — not built

See [`../PASS2_DESIGN_INPUTS.md`](../PASS2_DESIGN_INPUTS.md).
