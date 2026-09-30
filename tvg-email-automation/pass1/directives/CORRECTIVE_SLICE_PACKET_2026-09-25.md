# TVG Email Pass 1 — Corrective Staging Slice (CC authorized 2026-09-25 14:14 ET)

Status: CC-authorized corrective implementation of ALREADY-APPROVED Pass 1 behavior. Not a scope expansion.
Controlled real Hostinger message.received test: authorization valid but PAUSED until CC reviews this slice's evidence.
Header Auth: LOCKED (CC PASS 2026-09-25 09:25 ET). Do not redesign.

## Correction 1 — Worker real Hostinger fetch path (staging Intake Worker)
Extend existing staging Intake Worker (`tvg-email-intake-worker.json`) so a real pending intake_queue pointer (no hostinger_pointers.synthetic_message) can be claimed and processed:
- claim through existing atomic/idempotent queue path;
- use only mailbox/folder/UID pointer stored by Fast ACK;
- fetch authoritative Hostinger message metadata/text/source in the Worker, never in Fast ACK;
- extract/normalize Message-ID, Date, From, Reply-To, recipients, subject, body, Authentication-Results as required by approved Pass 1 logic;
- feed into existing filtering, identity, CRM-read-only matching, HOLD, dedup logic;
- persist email_events via existing authoritative staging path;
- fail closed to HOLD/error when retrieval or identity is uncertain;
- no customer send, no CRM lead creation, no production write, no Twilio send.
- Preserve synthetic path for repeatable smoke tests (do not replace).

## Correction 2 — Fast ACK malformed-payload response
Webhook missing required pointer fields must receive the designed controlled 4xx (not n8n default/success). No durable queue row for unrecoverably malformed pointer. Known defect: `alwaysOutputData` misplaced on pointer_incomplete branch (fast-ack JSON ~L140) so Respond node never runs.

## Current facts (Coordinator prep, 2026-09-25)
- Worker today: claim SQL filters on synthetic_message (worker JSON ~L41); Evaluate throws HOSTINGER_OFF for non-synthetic; no HTTP Request nodes; manual trigger only; no schedule.
- No Hostinger mail API credential exists in n8n. Hostinger Mail API: https://api.mail.hostinger.com/api/v1/... (local docs: hostinger-api-docs/MessagesApi.md, WebhooksApi.md). mailboxResourceId for info@vent-guys.com unknown.
- Hostinger webhook payload shape (folder/UID/mailbox id fields) is not documented publicly; Fast ACK pointer fields assumed.
- Guards: Dispatcher Twilio node disabled with placeholder cred; internal_sms_enabled=false; auto_send_enabled=false; after_hours_ack_enabled=false; no email-send nodes; no public.* writes; staging DB credential only (glkrykpksbsqmmilmjhs); in-code SQL guard refuses send tables / Hostinger.
- known_form_senders stays empty; filter rows unchanged; lead-status allowlist unchanged (CC policy lock pending after real test).
- Staging evidence row 21960aec-... preserved; non-synthetic uid 924150001 row stuck pending (expected under current Worker).

## Proposed implementation constraints (for Challenge to stress-test)
1. Real fetch uses a new n8n encrypted credential for the Hostinger Mail API (read-only scope if available). Creating/populating the real token is a Founder out-of-band step; token never in git/chat/screenshots.
2. Smoke evidence before real test uses a controlled MOCK Hostinger endpoint (staging-only, e.g. a mock n8n webhook or local fixture URL) configured by a staging base-URL setting, so no live Hostinger mailbox is read. Real API base URL only becomes live at the reopened test window.
3. Mock cases: happy fetch; fetch 404/5xx/timeout -> HOLD/error, fail closed; missing Authentication-Results -> uncertain -> HOLD per approved logic; missing Message-ID/Date -> handled per approved logic; duplicate claim -> idempotent no second email_events.
4. Synthetic regression: rerun prior happy/duplicate/hold Worker smokes (execs 3427-3429 equivalents) and they must still pass.
5. Fast ACK malformed proof: POST with valid Bearer but missing pointer fields -> designed 4xx, no intake_queue row; valid pointer still 200 with one row; missing/wrong auth still 403 (unchanged).
6. All workflows remain Inactive; test via manual execution / temporary test URL only. Hostinger webhook unregistered. PR #160 not merged.

## Return to CC
Challenge verdict; exact files/workflows changed; Worker real-fetch mock smoke evidence; synthetic regression proof; malformed 4xx proof; confirmations (inactive, webhook unregistered, prod/Twilio/customer untouched).
