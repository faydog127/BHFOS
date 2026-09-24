# 06 — n8n Intake, Worker, Reconcile, Digest (Pass 1 v5)

**Status:** DESIGN REVIEW ONLY — design only; workflows may be **built inactive**  
**LOCKED:** Fetch-free fast intake → durable pointer write → 2xx → **atomic claim** → worker fetch+identity; reconcile = stale HOLD + INBOX gap-fill; kill switch + resume; **form auth fail → HOLD**; consistent queue terminal states; no response/send stubs; internal notify Erron-approved only  
**Role:** `n8n_email_automation` (not `service_role`)  
**Supersedes:** `pass1-v4/06-n8n-intake-worker-reconcile.md`

---

## 1. Workflows (Pass 1 package)

| Workflow | Trigger | Active at Stage 1? |
|----------|---------|-------------------|
| `TVG Email Intake — Fast ACK` | Webhook | Inactive until controlled testing authorized; Hostinger traffic OFF until **Pre-webhook gate** |
| `TVG Email Intake — Worker` | Poll / short Schedule or queue push | Inactive until authorized |
| `TVG Email Intake — Reconcile` | **n8n Schedule** every 10–15 min | **Designed in Pass 1; schedule inactive** until Founder authorizes |
| `TVG Email — Daily Filtered Digest` | **n8n Schedule** daily | **Designed in Pass 1; schedule inactive** until authorized |

**Clarification:** “Cron disabled” = copied production **pg_cron** jobs remain inactive. Reconcile + digest are **n8n Schedule** triggers, not pg_cron.

---

## 2. Operational kill switch + resume

Setting: `automation_settings.intake_processing_enabled` (`tenant_id='tvg'`).

| Value | Behavior |
|-------|----------|
| `true` | Normal intake processing |
| `false` | Stop worker/reconcile **processing**; fast path uses `kill_switch_ack_mode` (default `park_2xx`: durable park on pointer + 2xx, **no fetch**). **Do not** create/update/delete Hostinger webhook configuration |

### Resume behavior

When `intake_processing_enabled` transitions from `false` → `true` (or on each reconcile tick while true):

| Row state | Resume action |
|-----------|---------------|
| `intake_queue.status = deferred_kill_switch` | Set to **`pending`** (`kill_switch_resume_mode=deferred_to_pending`). Worker may claim and process. |
| `intake_queue` / `email_events` with **HOLD** (`stale_processing`, `form_auth_failure`, or other) | **Do not** auto-clear. Remain HOLD until explicit human/ops action that still uses the same idempotent identity/pointer keys. |
| In-flight `processing` under TTL | Continues normally when switch is true |

Also keep `auto_send_enabled=false` always in Pass 1. There is **no** send path to accidentally enter on resume.

---

## 3. Fast ACK workflow (FETCH-FREE)

1. Webhook trigger (path e.g. `/tvg/hostinger-mail/inbound`).  
2. Validate Bearer (`05`). Fail → 401/403 + sampled reject log.  
3. Normalize **pointer**: `mailbox_resource_id`, `folder`, `uid` (bigint), `mailbox`, `event_type` — **MUST_CAPTURE_FROM_REAL_TEST**. Force `tenant_id='tvg'`.  
4. Read kill switch; if false → durable park (`deferred_kill_switch`) on pointer + 2xx; **no Hostinger calls**; exit.  
5. Insert-first `intake_queue` with pointer uniqueness. `message_id` / `fallback_hash` = NULL. Unique violation → 2xx duplicate exit.  
6. Respond **2xx**.  
7. **Forbidden on this path:** any Hostinger GET/list/search; computing Message-ID or fallback hash; writing `email_events`; claiming/processing.

---

## 4. Atomic worker claim + concurrency (Command Center item 6)

### 4.0 Claim pattern (REQUIRED)

Two workers **must not** claim the same row. Prefer `email_automation.claim_intake_batch(worker_id, limit)` or the equivalent inline SQL:

```sql
-- DESIGN ONLY — atomic claim
WITH claim AS (
  SELECT id
  FROM email_automation.intake_queue
  WHERE tenant_id = 'tvg'
    AND status = 'pending'
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT :batch_size
)
UPDATE email_automation.intake_queue q
SET status = 'processing',
    locked_at = now(),
    locked_by = :worker_id,
    attempt_count = q.attempt_count + 1,
    updated_at = now()
FROM claim
WHERE q.id = claim.id
RETURNING q.*;
```

| Rule | Design |
|------|--------|
| Lock | `FOR UPDATE SKIP LOCKED` — skip rows locked by another transaction |
| Transition | `pending` → `processing` in the **same** statement as the lock |
| Forbidden | SELECT pending ids then UPDATE without row lock (race) |
| Batch | `worker_claim_batch_size` (default 1) |
| Lease | `locked_at` + `locked_by`; TTL = `stale_processing_ttl_minutes` (default 10) |
| Heartbeat | Optional: worker refreshes `locked_at` while still working the same claim |
| Kill switch | If false, do not claim; exit |

### 4.1 `intake_queue` status machine

| Status | Kind | Meaning | Allowed transitions |
|--------|------|---------|---------------------|
| `pending` | active | Ready to claim | → `processing` (atomic claim); fast-path may insert as `deferred_kill_switch` instead |
| `processing` | leased | Claimed by a worker | → `done` \| `duplicate` \| `held` \| `error` |
| `deferred_kill_switch` | parked | Kill-switch park | → `pending` (resume only) |
| `done` | **terminal** | Successfully processed to a stable `email_events` outcome | none (ops may archive later; no auto-reopen) |
| `duplicate` | **terminal** | Pointer/identity already represented by another event | none |
| `held` | **terminal until ops** | HOLD for human review | → `pending` only via **explicit** ops action (same pointer/identity keys) |
| `error` | **terminal until ops** | Hard failure recorded | → `pending` only via **explicit** ops retry (never silent; never into send) |

**Terminal set (no automatic worker reclaim):** `done`, `duplicate`, `held`, `error`.  
**Non-terminal:** `pending`, `processing` (until TTL), `deferred_kill_switch`.

### 4.2 Alignment with `email_events.status`

| Queue terminal / outcome | Typical `email_events.status` | Notes |
|--------------------------|-------------------------------|-------|
| `done` + linked | `awaiting_pass2` | Pass 1 success end-state |
| `done` + filtered | `filtered` | Digest-eligible |
| `done` + lessen | `system_lessen` | No customer path |
| `held` | `held` | Includes `form_auth_failure`, `stale_processing`, phone/recipient HOLDs |
| `duplicate` | `duplicate_ignored` (existing row unchanged) | Do not fork identity |
| `error` | `error` | Plus `automation_errors` row |
| (park only) | optionally `deferred_kill_switch` if event row exists | Fast path usually has **no** event yet |

### 4.3 Background worker steps

1. **Atomic claim** `pending` rows (§4.0).  
2. Skip if kill switch false (should not have claimed).  
3. Authoritative fetch (meta/text/source).  
4. 404 → moved-message recovery (`05`); uncertain → HOLD + notify.  
5. Compute canonical identity: Message-ID if present, else fallback hash (`07`, includes body hash).  
6. Upsert `email_events` with identity uniqueness (`tenant_id='tvg'`); on unique conflict mark queue `duplicate` / link existing event — do not fork. Update `intake_queue.message_id` / `fallback_hash` / `email_event_id`.  
7. Upsert `integrations.external_references` for Hostinger ids (`entity_id` text).  
8. Parse Authentication-Results → `spf_pass` / `dkim_pass` / `dmarc_pass`.  
9. Deterministic filters via **`email_filter_lists`** (SELECT from DB — no hard-coded lists); Lessen → `system_lessen`.  
10. Recipient resolution + form trust + Reply-To / PSL (`04`). **Allowlisted form + auth fail → HOLD `form_auth_failure` (never filtered).**  
11. CRM identity resolution (SELECT contacts/leads only — RLS policies required). Case-insensitive email. Phone conflict → HOLD. Open lead statuses from settings allowlist.  
12. Set queue terminal: `done` / `duplicate` / `held` / `error`. Clear or retain lock fields per ops convention (`locked_at` may remain for audit).  
13. HOLD/error → internal notify (§7).  
14. **No** AI, knowledge-for-draft, validation, send, `email_responses`, or `email_send_queue` (tables absent).

---

## 5. Reconcile (10–15 min, same idempotent path)

n8n Schedule (inactive until authorized). Default interval: `reconcile_interval_minutes=12`.

| Check | Action |
|-------|--------|
| Kill switch false | Skip processing (do not mutate Hostinger webhooks). Optionally still record a heartbeat. |
| Kill switch true + `deferred_kill_switch` rows | Resume → set `pending` (§2) |
| `intake_queue.status=processing` and `locked_at` older than `stale_processing_ttl_minutes` | Set **HOLD** (`hold_reason=stale_processing`); write `automation_errors`; internal notify (`stale_intake_hold`). **Do not** silently reset to `pending`. **Do not** silently retry into any future send path. |
| `pending` older than SLA | Alert / verify worker; do not send |
| **List recent INBOX** via Hostinger `GET .../folders/INBOX/messages` within `reconcile_inbox_lookback_hours` | For each pointer missing from `email_events` / not already queued: **enqueue** `intake_queue` via same pointer uniqueness (idempotent). Worker computes identity later. |
| `email_events` stuck `fetching`/`received` | HOLD or re-enqueue **only** via same intake_queue pointer / identity keys |
| Message-ID upgrade possible via search | Upgrade; conflict → HOLD |

Reconcile **never** sends mail, never writes HCP, never sets `auto_send_enabled`, never mutates Hostinger webhooks, never creates response/send rows, never auto-clears `held` / `error` / `form_auth_failure`.

**Stale-intake recovery rule (Founder binding):** events stuck mid-processing → **flag HOLD and surface for review**; must **NEVER** silently retry into any future send path.

---

## 6. Rejected-webhook rate limiting / sampling

- Auth failures: do not write full payloads; log scrubbed samples only.  
- Cap samples with `rejected_webhook_sample_per_hour` (default 5).  
- Excess rejects: count metrics only; no PII spam to notify destination.

---

## 7. HOLD / error notifications (internal only)

| Rule | Design |
|------|--------|
| Destination | `review_notify_destination` — **Erron-approved** email or Slack only; null until Founder sets |
| Enable | `review_notify_enabled` (default false until destination **bound and tested** — Pre-webhook gate) |
| Content | Event id, status, hold/error code (incl. `form_auth_failure`), mailbox, subject excerpt — **no** customer send |
| Forbidden | Resolving notify destination from `resolved_recipient`, Reply-To, From, or any customer address |
| Audit | `notification_log` rows with `tenant_id='tvg'` |

---

## 8. Daily filtered-message digest

| Rule | Design |
|------|--------|
| Trigger | n8n Schedule daily — **inactive** until authorized |
| Query | `email_events` with `status in ('filtered','system_lessen')` since last digest, `tenant_id='tvg'` |
| Destination | `daily_filtered_digest_destination` — Erron-approved internal only; **set and tested** before controlled testing |
| Enable | `daily_filtered_digest_enabled` |
| Forbidden | Any customer address; including `held` / `form_auth_failure` rows in the “filtered” digest (HOLDs use HOLD alerts) |

---

## 9. Explicitly excluded nodes

OpenAI/Anthropic (any AI), Hostinger send, response/draft nodes, `email_send_queue` enqueue, n8n Wait-for-send, customer acks, `service_role`, HCP writes, knowledge lookup for response generation, response validation, hard-coded filter domain arrays (use DB), non-atomic claim loops.

---

## 10. Credentials

`HOSTINGER_WEBHOOK_SECRET`, `HOSTINGER_MAIL_API_TOKEN`, staging DB as `n8n_email_automation`, optional internal notify credential bound only to Erron-approved destination, PSL library dependency for registrable-domain compares.
