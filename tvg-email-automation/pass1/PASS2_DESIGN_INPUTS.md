# Pass 2 design inputs — not built

**STAGING ONLY / HOSTINGER OFF**

These notes are design inputs from the 2026-09-24 Founder operator-preference addendum. Pass 1 does not implement them. There is no draft review UI, no after-hours customer acknowledgement auto-send, and no follow-up cadence in this pack.

| Input | What was stated | What this pack does |
|---|---|---|
| Review surface | Mobile-first authenticated review | Not built |
| Timing | Time, holiday, and 8:30 AM targets | Not built. No scheduler and no customer send |
| Quiet hours | Not a Pass 1 control | `notification_quiet_hours` stays null. Pass 1 does not delay intake or notification for quiet hours |
| Urgency | Urgent candidates belong in the Decision Register or design notes only | No candidate list is stored here, and Pass 1 has no keyword rules |
| Voice | “The Vent Guys Team” | Design note only. Not a Pass 1 sender, reply voice, or customer acknowledgement |
| Draft review | Mobile-first authenticated review | Not built |
| After-hours acknowledgement | Stays disabled | `after_hours_ack_enabled` is false. That is not permission to set `auto_send_enabled` |
| Follow-up | OPEN | No cadence default. `escalation_after` stays null |

Coordinator Decision IDs for these items were not in the workspace. Item 6 (follow-up) stays OPEN until that file is committed.
