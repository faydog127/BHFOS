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
| Follow-up | TVG-EMAIL-P1-D028 Open / Proposed | No cadence default. `escalation_after` stays null |

Pass 1 implements TVG-EMAIL-P1-D023 only inside the existing recipient and configuration model: one Founder destination, `founder_mobile_ref`, plus `configuration_audit`. D024 through D028 stay documentation.
