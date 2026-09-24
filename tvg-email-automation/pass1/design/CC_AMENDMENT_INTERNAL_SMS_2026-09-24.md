# COMMAND CENTER AMENDMENT — PASS 1 INTERNAL SMS NOTIFICATIONS

**Time locked:** 2026-09-24 ~09:23 ET  
**Scope:** TVG Email Automation — Pass 1  
**Status:** FOUNDER-APPROVED / LOCKED  
**Purpose:** Internal notification only. Does **not** authorize customer SMS, customer email, AI classification, or live Hostinger activation.

## Notification architecture

Preserve the channel-independent model:

`notification event → notification service → delivery channel`

- Pass 1 preferred delivery channel: **SMS** to the Founder-approved mobile number.
- Future CRM mobile push must be addable/replaceable without changing email-intake or business logic.
- SMS transport is **not** authoritative state. Network/CRM automation records the notification event and delivery status.

## Immediate SMS events

**Send** immediate internal SMS when:

1. A legitimate/actionable inbound email successfully reaches `awaiting_pass2`.
2. An inbound email reaches `held`.
3. A material intake/processing error requires human attention.

**Do not** send an individual SMS for:

- `filtered`
- `system_lessen`
- ordinary automated/vendor traffic
- duplicate webhook processing
- reconcile rediscovery of an already-notified message

Filtered/system traffic remains covered by the daily digest.

## Pass 1 content boundary

Pass 1 notification content must be **deterministic only**.

**Allowed:** sender name; sender email when operationally useful; sanitized/truncated subject; deterministic fields from approved/allowlisted website form; event status; HOLD/error reason.

**Must not infer:** service type from ordinary email text; customer intent; location from free-form content; urgency; job category; any other AI/heuristic classification.

Do **not** create keyword classification rules as a substitute for Pass 2 AI.

Example ordinary inbound:

```
TVG: New email — needs response
From: Kelly Martin
Subject: Dryer vent question
No reply sent.
```

Approved website-form fields (e.g. submitted service selection) may appear as structured source data, not inferred classification.

## Deduplication

Enforce unique notification identity equivalent to:

`(canonical email_event_id, notification_kind)`

in `notification_log`.

Duplicate webhooks, worker retries, and reconciliation must not produce duplicate SMS for the same event/kind.

## Storm protection

Configurable SMS rate protection. Default: `max_internal_sms_per_hour = 10`.

When threshold reached:

- suppress additional ordinary actionable-inbound texts for that window;
- send one summary: `TVG: 12 additional new emails received — review queue.`;
- do not repeat summary texts for the same suppression window;
- prioritize HOLD/error within the same safety mechanism;
- record every suppressed notification event (suppression ≠ lost state).

Exact storm behavior must be tested with fixtures before Pre-webhook approval.

## SMS sanitization / privacy

- Never include email body text.
- Never include customer phone numbers.
- Never include street addresses.
- City only when from approved structured form field.
- Subject excerpt max ~60 characters; strip URLs; strip control characters; normalize whitespace; no arbitrary HTML.
- Sender-controlled subject is untrusted display data and must never alter workflow behavior.

## Credential isolation

- Separate internal-alert credential. Do **not** reuse production/customer-facing SMS credential.
- Preferred: dedicated Twilio subaccount, or restricted Twilio API key scoped to internal alert path.
- Alert credential must not grant unrestricted customer-SMS capability.
- Provisioning/attaching real SMS credential requires **explicit Founder approval**.
- Secrets only in n8n Credentials / approved secret storage. Never in workflow JSON, SQL settings, logs, repo files, or notification tables.

## Carrier-delivery readiness (before Pre-webhook can pass)

1. Identify actual sending number.
2. Confirm U.S. registration (A2P 10DLC or verified toll-free as applicable).
3. Confirm use case permits internal operational alerts.
4. Send real test SMS to Founder-approved phone; record delivery evidence.
5. Confirm delivery failure is logged/surfaced (not silent success).

## Notification audit (`notification_log` minimum)

- `tenant_id='tvg'`
- canonical `email_event_id`
- notification kind
- channel
- destination reference (no unnecessary secrets)
- attempted timestamp
- provider message/reference id when available
- delivery state
- suppression state/reason
- failure/error state

## Future mobile-app path

Do not couple actionable-inbound detection to Twilio. Future: same notification event → CRM mobile push. SMS may become fallback / critical backup / disabled. Must not require rewriting intake classification, identity, HOLD, or deduplication.

## Authorization boundary

Authorized for **contained staging build only** under existing CC staging directive.

Still prohibited:

- real SMS credential attachment without Founder approval;
- live SMS delivery except explicitly authorized test;
- customer SMS;
- Hostinger live webhook activation;
- production mutation;
- AI/classification work;
- customer-facing sends.

## Implementation return packet requirements

Add corresponding schema/config, workflow nodes **inactive**, fixtures, deduplication tests, storm tests, and notification evidence to the staging implementation return packet.

**Notification policy is LOCKED.** Continue implementation without returning this item to Founder unless credential provisioning, carrier-registration choice, cost, or another material decision requires Founder authority.
