# Pass 2 design inputs — not built

**STAGING ONLY / HOSTINGER OFF**

These notes are design inputs from the 2026-09-24 Founder operator-preference addendum. Pass 1 does not implement them. There is no draft review UI, no after-hours customer acknowledgement auto-send, and no follow-up cadence in this pack.

| Input | What was stated | What this pack does |
|---|---|---|
| Draft review | TVG-EMAIL-P1-D024 Recommendation. Mobile-first authenticated view, edit, approve, or reject. No bearer open approval links | Not built. Pass 1 creates no drafts, responses, or sends |
| Time of day | TVG-EMAIL-P1-D025 Recommendation. Timezone, working hours, holidays, after-hours acknowledgement, and about 8:30 AM next-business-day preparation | Not built. No scheduler and no customer send. Unset material preferences stay `DECISION_REQUIRED` |
| Quiet hours | Not a Pass 1 control | `notification_quiet_hours` stays null. Pass 1 does not delay intake or notification for quiet hours |
| Urgency | TVG-EMAIL-P1-D026 Recommendation. Candidates: property management, commercial, and fire/smoke/CO/burning-smell | Design note only. Pass 1 has no keyword rules and no emergency acknowledgement language |
| Voice | TVG-EMAIL-P1-D027 Recommendation. “The Vent Guys Team.” The mailbox already has a signature | Design note only. Pass 1 does not draft, so it does not add or duplicate a signature |
| After-hours acknowledgement | Stays disabled until separately authorized | `after_hours_ack_enabled` is false. That is not permission to set `auto_send_enabled` |
| Follow-up | TVG-EMAIL-P1-D028 Open / Proposed | No cadence default. `escalation_after` stays null. Distinct from unapproved-by-deadline escalation |
| Unapproved-by-deadline | TVG-EMAIL-P1-D029 through D034. Policy architecture only. Challenge verdict is CHALLENGE_CONCERNS / proceed-with-concerns | Not built. Pass 1 impact is none. No escalation, no send-anyway, no fallback customer send |
| Outbound observation | TVG-EMAIL-P1-D035. Challenge verdict is CHALLENGE_PASS. Observation of Hostinger webmail, mobile Sent, later CRM sends, and a Handled action for non-email | Not built. Pass 1 impact is none. No observation job, no Handled UI, no IMAP, and `send_anyway_enabled` is not set |

Pass 1 implements TVG-EMAIL-P1-D023 only inside the existing recipient and configuration model: one Founder destination, `founder_mobile_ref`, plus `configuration_audit`. D024 through D035 stay documentation.

The unapproved-by-deadline addendum is [`directives/CC_ADDENDUM_UNAPPROVED_BY_DEADLINE_ESCALATION_2026-09-24.md`](directives/CC_ADDENDUM_UNAPPROVED_BY_DEADLINE_ESCALATION_2026-09-24.md). The challenge verdict is [`directives/CHALLENGE_VERDICT_UNAPPROVED_BY_DEADLINE.md`](directives/CHALLENGE_VERDICT_UNAPPROVED_BY_DEADLINE.md). That verdict does not authorize implementation.

The outbound-observation addendum is [`directives/CC_ADDENDUM_D035_AUTHORITATIVE_OUTBOUND_OBSERVATION_2026-09-24.md`](directives/CC_ADDENDUM_D035_AUTHORITATIVE_OUTBOUND_OBSERVATION_2026-09-24.md). The challenge verdict is [`directives/CHALLENGE_VERDICT_D035_OUTBOUND_OBSERVATION.md`](directives/CHALLENGE_VERDICT_D035_OUTBOUND_OBSERVATION.md): CHALLENGE_PASS. It does not authorize implementation, sending, Hostinger, Pass 1 expansion, or `send_anyway_enabled` true. Handled is not an email reply. CRM absence is not a passed gate. Uncertain Sent state fails closed.

These items stay unset. This pack does not supply them:

- Grace period duration (D029). An unset grace period is `DECISION_REQUIRED`.
- Eligible response classes (D030). No allowlist is recorded here.
- Fallback acknowledgement wording (D031). No template is recorded here.
- The Stage 2 customer path (D034): approved fallback, allowlisted send-anyway, or explicit Founder acceptance of reminder-only.
