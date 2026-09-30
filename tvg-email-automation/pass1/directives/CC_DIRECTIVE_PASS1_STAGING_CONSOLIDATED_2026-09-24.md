# COMMAND CENTER DIRECTIVE — TVG EMAIL AUTOMATION PASS 1
## Consolidated Implementation Locks + Staging Build Authorization

**Date:** 2026-09-24 (ET)  
**Scope:** TVG Email Automation — **NOT NOS**  
**Artifact:** `pass1-v5`  
**Staging:** `glkrykpksbsqmmilmjhs`  
**Production:** `wwyxohjnyqnegzbxtuxs` — read-only; do not mutate  
**Authority:** Founder / Command Center  
**Decision:** **PASS 1 STAGING BUILD PROCEED**

This directive supplements `pass1-v5`. It is the consolidated record of the Founder/Command Center implementation locks and the contained staging authorization. The design loop is **CLOSED except for material discoveries**. The **Pre-webhook gate is CLOSED**. **Production is CLOSED**.

## Scope and phase boundary

Pass 1 is limited to intake, identity, routing, logging, recovery, and internal notification. It may record durable inbound email state, resolve identity, route to filtered/held/linked states, recover stale or missed intake, and notify the Founder-approved internal destination through the locked notification path.

Pass 1 does **not** include AI, classification, knowledge grounding, draft generation, customer responses, customer email, `email_responses`, `email_send_queue`, automated customer sends, or automatic CRM lead creation. There is no customer-facing communication in this authorization. `auto_send_enabled` remains false.

The staging build is authorized as a contained implementation activity. This authorization does not authorize live Hostinger traffic, activation of mailbox schedules, production mutation, customer communication, or use of production credentials in staging.

## A. Staging authorization

The following are authorized on staging only:

1. Apply or maintain the Pass 1 schema and role on `glkrykpksbsqmmilmjhs`.
2. Build or import the n8n workflows with all workflows and schedules **inactive**.
3. Run synthetic fixtures, deterministic routing tests, recovery tests, notification tests, deduplication tests, and staging evidence collection.
4. Implement the locked internal SMS notification policy as an inactive, channel-independent notification path, subject to its credential and carrier boundaries below.
5. Record implementation evidence in Git and in the required return packet.

The staging SQL apply is already evidenced in `staging-apply/APPLY_REPORT.md`: it was applied on 2026-09-24 to `glkrykpksbsqmmilmjhs`; production was not touched. That evidence does not open the Pre-webhook or Production gates. The base apply includes `notification_log`; the SMS transport/schema follow-up remains a Cursor/PR follow-up and must remain inactive.

## B. Before Hostinger or production

Before any real Hostinger traffic or controlled mailbox activation, the Pre-webhook gate must separately pass. At minimum, the implementation must:

- lock form-recognition/filter ordering and identify which field each filter evaluates, including the form-path HOLD override;
- resolve the production-derived open-lead status decision rather than relying on an unverified allowlist;
- capture a real Hostinger webhook/authentication sample and either correct website DKIM/DMARC alignment or explicitly accept legitimate forms entering HOLD temporarily;
- set and test Founder-approved internal notification destinations;
- verify the kill switch, atomic worker claim, reconcile path, deduplication, and recovery behavior;
- keep Hostinger webhook traffic off, n8n schedules inactive, and production read-only until the gate is explicitly passed.

No staging implementation shortcut may be treated as live authorization.

# LOCKED IMPLEMENTATION SECTIONS

## 1. System-health heartbeat

The system must maintain a durable health heartbeat using `last_successful_health_at`. A successful heartbeat means the health/reconcile path completed its expected checks and durable writes; it is not inferred from an empty inbox.

Raise an internal SMS alert when the heartbeat is stale beyond the configured threshold, when reconcile fails repeatedly, or when a required dependency is unreachable. Also alert on pipeline silence or intake lag when Hostinger has newer mail that has not appeared in durable intake within the applicable SLA. A quiet inbox by itself is **not** a fault.

Health alerts must be deterministic, durable, and deduplicated. The system must emit at most one alert for an outage condition and at most one recovery alert for the corresponding recovery, unless a new distinct incident is established. Reconcile and health checks must not create alert storms or duplicate recovery notices.

## 2. Durable notification outbox

Notification delivery is a durable outbox flow:

`email event → durable notification record → dispatcher → SMS`

`notification_log` is the authoritative durable notification outbox for Pass 1. A notification intent must be recorded before dispatch is attempted. The uniqueness key is equivalent to `(email_event_id, notification_kind)`; duplicate webhooks, worker retries, and reconcile rediscovery must not produce duplicate notifications for the same event and kind.

A Twilio or other SMS transport outage must not lose the notification intent. The dispatcher must leave the durable record available for retry/reconciliation and must record attempted, delivered, suppressed, and failed states as applicable. SMS transport is not authoritative business state; the recorded notification event and delivery state are.

The notification design remains channel-independent so that an internal CRM mobile push or another approved channel can be added later without rewriting intake, identity, routing, HOLD, or deduplication logic.

## 3. First-live watermark: `live_notification_started_at`

Use a first-live watermark named `live_notification_started_at` to distinguish historical backlog from live notification behavior.

- Before the watermark, individual historical events must not generate individual SMS messages.
- At most one deterministic backlog summary may be emitted for the pre-watermark backlog.
- After the watermark, normal per-event notification rules apply.
- Reconcile must respect the watermark and must not turn historical rediscovery into a per-message SMS storm.

The watermark is an operational notification boundary. It must not discard intake, event, identity, routing, or audit state.

## 4. Threading metadata

Capture `In-Reply-To` and `References` when present as metadata only. Do not implement thread business logic, conversation grouping, reply synthesis, or thread-based customer behavior in Pass 1.

`Message-ID` remains the canonical durable email identity. Threading headers are supporting evidence and searchable metadata; they must not replace Message-ID idempotency or cause an automated response.

## 5. Attachment and size policy

Pass 1 must not execute, scan, or persist attachment bytes. Store metadata only, such as filename, media type, size, count, and provider identifiers when needed for controlled retrieval.

Cap text and HTML excerpts to the configured safe limits. Do not persist a permanent full MIME message or unbounded body content. Retention and any future byte-handling policy are deferred and must not be invented as part of this staging authorization.

Attachment metadata and excerpts must not be used to infer service type, urgency, customer intent, location, or any other AI/heuristic classification. Sensitive content must not be placed in SMS.

## 6. Timing and operating hours

Targets are:

- webhook receipt to notification dispatcher: **≤ 2 minutes**;
- reconcile discovery of a missed item: **≤ 15 minutes**;
- health and operational alerts: **24/7**.

There are no application-defined quiet hours for intake, recovery, health, or notification safety. Founder DND controls may make alerts inaudible or suppress device presentation, but DND is not an application processing pause and does not authorize dropping, filtering, or delaying durable state.

Timing failures must be observable and must follow the heartbeat, lag, outage, and recovery deduplication rules above.

## 7. SMS is one-way

SMS is an internal, one-way alert channel only. Do not implement inbound SMS commands, `DONE`, `CALL`, `STOP`, workflow control by SMS, customer SMS, or any interpretation of SMS replies.

The system must not treat a carrier response or an inbound text as authoritative intake state. Any future control plane requires a separate explicit decision and authorization.

## 8. Alert wording and content

Use **“review”** rather than **“needs response”** in alert wording. Alerts must be deterministic and must not claim that automation replied. A compliant ordinary-inbound example is:

```text
TVG: New email — review
From: Kelly Martin
Subject: Dryer vent question
No reply sent by automation.
```

Allowed content includes sender name, sender email when operationally useful, a sanitized/truncated subject, deterministic fields from an approved structured form, event status, and a deterministic HOLD or error reason. Do not infer service type, customer intent, location from free-form text, urgency, job category, or any other classification. Do not create keyword rules as a substitute for Pass 2 AI.

Never include email body text, customer phone numbers, street addresses, arbitrary HTML, or untrusted workflow instructions in SMS. Subject excerpts must be sanitized, URL-stripped, control-character-stripped, whitespace-normalized, and bounded (approximately 60 characters). City may appear only when supplied as an approved structured form field.

## 9. n8n environment separation

Every n8n workflow and operational artifact must make its environment explicit with `[STAGING]` or `[PROD]` prefixes. This applies to workflow names, alert labels, evidence, and other operator-visible identifiers where applicable.

Staging uses staging-only credentials. Production credentials must never be placed in staging, committed to Git, placed in workflow JSON, SQL settings, logs, notification rows, or documentation. Internal SMS alert credentials are separate from any customer-facing or production SMS credentials.

Real SMS credential attachment requires explicit Founder approval. Secrets belong only in n8n Credentials or approved secret storage. Do not provision live carrier access merely because the staging notification nodes exist.

## 10. Git is the source of record

Git is the source of record for implementation artifacts, configuration templates, workflow definitions, migrations, tests, fixtures, evidence indexes, and this directive/register. Changes must be reviewable and traceable to the applicable decision and environment.

The box copy is working evidence; it does not override the repository history, the locked directive, or the environment boundary. Do not edit historical Pass 1 packs to conceal differences. Record material discoveries and required amendments explicitly.

# PRODUCTION-GATE DEFERRED ITEMS

These items are deferred and must not block the contained staging build. They are nevertheless required before production reliance.

## 11. CRM lead creation — DEFERRED

Pass 1 performs SELECT-only CRM reads for identity linking. It must not create CRM contacts or leads and must not add CRM INSERT/UPDATE policies for this purpose. Automatic lead creation is deferred to a separately authorized phase.

## 12. CRM lead-gap investigation — REQUIRED before production reliance

Investigate the CRM lead gap beginning July 24 (the production gap period) before relying on this automation in production. The investigation must use read-only evidence, identify whether leads were missed, duplicated, misrouted, or suppressed, and document the production-derived status and routing implications.

A proposed staging open-lead allowlist is not a substitute for that investigation. The current design default is `new`, `contacted`, `qualified`, and `escalated`; terminal or closed values, including `Customer`, must not be auto-linked. Any production reliance requires a documented Founder/Command Center decision based on actual status evidence.

## 13. Minimum production security hardening — PRODUCTION GATE

Minimum production security hardening is a production gate. It includes environment and credential separation, least-privilege roles, complete RLS and policy review, secret handling, webhook authentication, notification destination controls, auditability, rate/storm protection, and verification that no customer address can become an internal notification destination.

Production must remain read-only for this workstream until the hardening evidence is reviewed and separately authorized. Staging advisors, warnings, or successful fixtures do not constitute production security approval.

## 14. Decision Register — REQUIRED NOW

Create and maintain `decision-register/TVG_EMAIL_AUTOMATION_DECISION_REGISTER.md`. It must enumerate the active implementation locks, the staging authorization, the SMS amendment, and every deferred/production-gate decision, with decision ID, status, authority, scope, implementation impact, evidence, and gate/next action. The register is part of the return packet and must be updated when a material discovery or authorization changes.

# SMS POLICY — REMAINS LOCKED

The prior internal-SMS amendment is incorporated and remains **FOUNDER-APPROVED / LOCKED**. It authorizes contained staging implementation only; it does not authorize customer SMS, customer email, AI classification, live Hostinger activation, production mutation, or real SMS credential attachment without explicit Founder approval.

## Approved / authorized now

- Channel-independent notification architecture: notification event → notification service → delivery channel.
- Preferred Pass 1 delivery channel: SMS to the Founder-approved mobile number, only when the credential/carrier boundary is separately satisfied.
- Immediate internal SMS for a legitimate/actionable inbound email that reaches `awaiting_pass2`, an inbound email that reaches `held`, or a material intake/processing error requiring human attention.
- Deterministic content only: sender name/email when useful, sanitized subject, approved structured form fields, event status, and HOLD/error reason.
- Durable `notification_log` outbox records with uniqueness equivalent to `(canonical email_event_id, notification_kind)`.
- Configurable storm protection; default `max_internal_sms_per_hour = 10`. When the threshold is reached, suppress ordinary actionable-inbound texts for that window, send one summary, prioritize HOLD/error, and record every suppressed event.
- SMS sanitization: no body, phone number, street address, arbitrary HTML, or untrusted control data; subject excerpt approximately 60 characters; city only from an approved structured field.
- Inactive staging workflow nodes, fixtures, deduplication tests, storm tests, and notification evidence.

## Not authorized

- Individual SMS for `filtered`, `system_lessen`, ordinary automated/vendor traffic, duplicate webhook processing, or reconcile rediscovery of an already-notified message; those remain in the daily digest or durable audit path.
- Inbound SMS commands, `DONE`, `CALL`, `STOP`, workflow control by SMS, or customer SMS.
- Customer email, customer-facing sends, AI/classification, keyword classification, draft generation, `email_responses`, or `email_send_queue`.
- Live Hostinger webhook activation or active mailbox schedules.
- Production mutation or production credentials in staging.
- Real SMS credential attachment without explicit Founder approval; unrestricted customer-SMS capability; secrets in workflow JSON, SQL settings, logs, repository files, or notification tables.
- Live SMS delivery except an explicitly authorized test to the Founder-approved phone.

## SMS carrier and credential prerequisites before Pre-webhook

Before the Pre-webhook gate can pass, identify the actual sending number, confirm applicable U.S. registration (A2P 10DLC or verified toll-free as applicable), confirm that the use case permits internal operational alerts, send an explicitly authorized real test SMS to the Founder-approved phone, and prove that delivery failure is logged and surfaced rather than treated as silent success.

Use a dedicated Twilio subaccount or restricted API key for internal alerts where approved. The alert credential must not grant unrestricted customer-SMS capability. Future CRM mobile push must be addable or replaceable without changing intake or business logic.

## Required return packet checklist

The staging implementation return packet must include:

- the directive and updated Decision Register;
- schema/config changes mapped to the locked notification and health requirements;
- inactive n8n workflow definitions and proof that schedules remain disabled;
- evidence that staging-only credentials and environment prefixes are used;
- health heartbeat, stale/failure/dependency/lag alert, outage/recovery dedupe, and timing evidence;
- watermark evidence for pre-live backlog and post-live behavior;
- threading metadata capture evidence without thread business logic;
- attachment metadata/size-boundary evidence showing no persisted bytes;
- one-way SMS boundary and deterministic wording/privacy evidence;
- notification outbox uniqueness, retry, failure, suppression, and storm-protection tests;
- fixtures for actionable inbound, HOLD, errors, filtered/system traffic, duplicate webhooks, reconciliation, and watermark behavior;
- evidence that no customer address is a notification destination;
- the locked SMS amendment and carrier/credential readiness status;
- `APPLY_REPORT.md`, Challenge verdicts, and PR #160 references;
- an explicit statement that Hostinger remained off, schedules remained inactive, production remained untouched, and no customer communication occurred.

# FINAL OPERATING STATE

**PASS 1 STAGING BUILD PROCEED.**  
**PRE-WEBHOOK CLOSED.**  
**PRODUCTION CLOSED.**

Proceed in staging within these locks. Stop and record any material discovery that changes identity, routing, notification safety, security, or environment boundaries; do not silently broaden scope or infer live authorization.
