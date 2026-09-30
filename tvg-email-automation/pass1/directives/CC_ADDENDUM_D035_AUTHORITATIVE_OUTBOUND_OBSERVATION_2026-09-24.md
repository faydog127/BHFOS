# D035 — Authoritative Outbound Communication Observation

**Date:** 2026-09-24  
**Status:** Active architectural requirement  
**Implementation:** Pass 2 dependency  
**Pass 1 impact:** NONE — documentation / Decision Register only

This addendum records the Founder decision that the system must observe authoritative outbound communication. It is durable Decision Register evidence for Pass 2. It does **not** authorize sending, expand Pass 1 SQL/n8n/staging-apply, activate Hostinger or Twilio, mutate production, invent Handled UI beyond the Founder text below, or set `send_anyway_enabled` true.

---

## 1. Must observe authoritative outbound communication

The system must observe authoritative outbound communication from these sources:

1. **Hostinger webmail replies** — manual replies sent via Hostinger webmail.
2. **Founder mobile mail client replies** — replies sent from the Founder’s mobile mail client that land in authoritative Hostinger server-side Sent state.
3. **Later CRM-originated email sends** — once that outbound path exists and is observable.
4. **Explicit human-handled communication via CRM/mobile review for non-email** — phone, SMS, or other non-email channels recorded as Handled (see §2).

---

## 2. Non-email Handled action (mobile review)

A **Handled** action on mobile review records:

- Handled **timestamp**
- **Actor**
- **Channel** (`phone` / `sms` / `other`)
- Optional **outcome** / **note**

Handled is treated as **equivalent to a human response** for:

- Canceling pending automated sends
- Suppressing follow-up automation
- Updating customer-contact state
- Determining whether more automated outreach is appropriate

Handled must **NOT**:

- Be represented as an email reply
- Be inserted into an email thread

**Email-thread reconstruction** remains actual observed email plus RFC threading metadata only.

---

## 3. Required uses

Authoritative outbound observation is required for:

- Thread reconstruction
- Human-reply detection
- Pre-send cancellation
- Customer-contact / who-responded-last
- Follow-up-watchdog suppression
- Avoiding duplicate or contradictory automated outreach

**Observation does NOT grant sending authority.**

---

## 4. Stage 2 activation gate for `send_anyway_enabled`

Controlled testing must demonstrate all of the following before Stage 2 may enable `send_anyway_enabled`:

1. Hostinger webmail manual reply is detected.
2. Founder mobile mail reply is detected in authoritative Hostinger Sent state.
3. CRM-originated sends are observable once that path exists.
4. Mobile Handled reaches authoritative server-side state.
5. Both outbound email and Handled cancel pending automated sends.
6. Both suppress inappropriate follow-up.
7. Duplicate observation does not create duplicate communication events.

**Mobile-client test (specific):** Confirm that the phone mail app saves sent messages to Hostinger **server-side Sent** (not local-only).

---

## Boundary

- Pass 1 impact: **NONE**
- Do not expand Pass 1 scope, SQL, n8n, Hostinger, Twilio, or production.
- Do not invent Handled UI beyond the Founder text in this addendum.
- Do not set `send_anyway_enabled` true.
- Wire as Pass 2 dependency for D032 human-reply cancel guard and D029+ escalation; document Stage 2 proof checklist.

---

## Decision Register

- **ID:** `TVG-EMAIL-P1-D035`
- **Related:** D032 (human-reply cancel guard depends on these observation sources, including Handled); D029+ (escalation / Stage 2 gates)
