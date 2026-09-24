# 05 — Hostinger Endpoints (Pass 1 v5)

**Status:** DESIGN REVIEW ONLY — design only  
**Base URL:** `https://developers.hostinger.com` Mail API host as documented: `https://api.mail.hostinger.com`  
**API auth (outbound calls):** `Authorization: Bearer <HOSTINGER_MAIL_API_TOKEN>`  
**Webhook auth (inbound):** `Authorization: Bearer <HOSTINGER_WEBHOOK_SECRET>` — **MUST_CAPTURE_FROM_REAL_TEST** exact header form  
**Supersedes:** `pass1-v4/05-hostinger-endpoints.md` (aligned with Pre-webhook gate; Auth-Results needed for form-auth HOLD)

Do **not** invent JSON field paths. Mark unknowns as **MUST_CAPTURE_FROM_REAL_TEST**.

---

## 1. Webhook authentication

| Item | Design |
|------|--------|
| Secret storage | n8n Credential / env only — never git, never Supabase tables, never logs |
| Expected header | `Authorization: Bearer <HOSTINGER_WEBHOOK_SECRET>` (**MUST_CAPTURE_FROM_REAL_TEST**) |
| Order | Auth **before** durable write |
| Fail closed | Missing/invalid → 401/403; no `intake_queue` / `email_events` row |
| Rate limit / sampling | Rejected auth attempts sampled/rate-limited per `rejected_webhook_sample_per_hour` |
| Kill switch | Does **not** delete or reconfigure Hostinger webhooks |

Setup APIs (not per-message):

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/v1/mailboxes/{mailboxResourceId}/webhooks` | Create; one-time `secret` |
| `GET` | `/api/v1/mailboxes/{mailboxResourceId}/webhooks` | List |
| `GET` | `/api/v1/mailboxes/{mailboxResourceId}/webhooks/{webhook}` | Get |
| `PATCH` | `/api/v1/mailboxes/{mailboxResourceId}/webhooks/{webhook}` | Update |
| `DELETE` | `/api/v1/mailboxes/{mailboxResourceId}/webhooks/{webhook}` | Delete |
| `POST` | `.../webhooks/{webhook}/regenerate-secret` | Rotate |
| `POST` | `.../webhooks/{webhook}/test` | Capture real payload |

**Pass 1 / Stage 1:** Hostinger webhook traffic **OFF** until **Pre-webhook gate** PASS + Founder authorization for controlled testing.

---

## 2. Durable intake before acknowledgment (fetch-free)

1. Validate Bearer.  
2. Normalize **webhook pointer**: `mailbox_resource_id`, `folder`, `uid` (as **bigint**) — field paths **MUST_CAPTURE_FROM_REAL_TEST**.  
3. Honor kill switch `intake_processing_enabled` (park policy; webhook config unchanged).  
4. **Durable** unique insert into `intake_queue` on `(tenant_id, mailbox_resource_id, folder, uid)`. Identity fields (`message_id`, `fallback_hash`) stay **NULL**.  
5. **Do not call Hostinger GET/list/search on the fast path.**  
6. Only then return **HTTP 2xx**.  
7. Heavy work (including any Hostinger fetch) happens only in the background worker / reconcile.

Duplicate pointer → still **2xx** (idempotent ack). Prefer avoiding 5xx retry storms.

---

## 3. Fast / async webhook 2xx

| Case | HTTP |
|------|------|
| Auth fail | 401/403 |
| Accepted new or duplicate pointer | **2xx** |
| Kill-switch park (default `kill_switch_ack_mode=park_2xx`) | **2xx** after durable park row |
| Malformed beyond recovery before durable write | Prefer 4xx; document choice in fixtures |

Worker failures after 2xx do **not** change the already-sent ack.

---

## 4. Corrected folder-scoped message search

**WRONG (do not use):** `POST /api/v1/mailboxes/{mailboxResourceId}/messages/search`  
**CORRECT (Hostinger Messages API):**

```
POST /api/v1/mailboxes/{mailboxResourceId}/folders/{folder}/messages/search
```

- `{folder}` is URL-encoded (e.g. `INBOX`, `INBOX.Spam`).  
- Query params: `page`, `perPage`, `sort` (defaults per docs).  
- Body: search filters — **exact Message-ID filter schema MUST_CAPTURE_FROM_REAL_TEST**.  
- Grounded in Hostinger `MessagesApi.md` `searchMessages()`.

For moved-message recovery, search the last-known folder first; if needed, search additional folders from a configured list (**MUST_CAPTURE_FROM_REAL_TEST**). Fail closed to HOLD when zero or many matches.

---

## 5. Authoritative message fetch (worker only)

Webhook payload is a **pointer only**. Authoritative content comes from Hostinger GET — **worker / reconcile only, never fast path**:

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/api/v1/mailboxes/{mailboxResourceId}/folders/{folder}/messages/{uid}` | Metadata / envelope |
| `GET` | `.../messages/{uid}/text` | Body text (prefer for BodyNormalization) |
| `GET` | `.../messages/{uid}/source` | Raw source for Message-ID, Date, **Authentication-Results**, Auto-Submitted, etc. |
| `GET` | `.../messages/{uid}/attachments/{attachmentId}` | Avoid in Pass 1 unless ops require; prefer metadata only |

URL-encode folder segments. Token: `HOSTINGER_MAIL_API_TOKEN` in n8n Credentials only.  
`uid` path parameter is Hostinger’s numeric UID → stored as **bigint**.

**Auth-Results:** Required for form trust and for **form_auth_failure HOLD**. Capture header shape from `/source` (**MUST_CAPTURE_FROM_REAL_TEST**).

---

## 6. List recent INBOX (reconcile gap-fill)

Reconcile must discover messages that never produced a durable `email_events` row (missed webhook, park gap, etc.):

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/api/v1/mailboxes/{mailboxResourceId}/folders/{folder}/messages` | `listMessages()` — list recent messages |

Parameters (per Hostinger docs): `page`, `perPage`, `sort` — **MUST_CAPTURE_FROM_REAL_TEST** exact sort for “most recent first” and pagination limits.

**Reconcile design:**

1. Call `listMessages` for folder `INBOX` (and only configured folders — default INBOX only in Pass 1).  
2. Restrict to lookback window `reconcile_inbox_lookback_hours` (default 24). How list items expose date/UID — **MUST_CAPTURE_FROM_REAL_TEST**.  
3. For each listed message pointer `(mailbox_resource_id, folder, uid)`: if no matching `email_events` (by later identity) **and** no open/done intake for that pointer, **enqueue** via the **same** idempotent `intake_queue` insert (pointer uniqueness).  
4. Worker then fetches and computes identity as usual.  
5. Do not create a second identity from folder/UID alone.

---

## 7. Message-ID as durable identity (on `email_events`)

- Prefer RFC Message-ID from authoritative `/source` (or metadata).  
- Normalize consistently (recommend bare id, trimmed); keep original in `hostinger_pointers`.  
- Uniqueness: `(tenant_id, mailbox, message_id)` on **`email_events`** (not on `intake_queue`).  
- Never invent a fake RFC Message-ID.  
- Fast path does **not** require Message-ID.

---

## 8. Stable fallback hash (worker)

When Message-ID missing, compute fallback hash per `07-idempotency.md`:

**Include:** mailbox, normalized sender, normalized recipient, normalized subject, **Date header**, **normalized body hash**.  
**Exclude:** folder, uid, `received_at` / `webhook_received_at`, random nonces.

Locators (folder/uid) are updated in place when the same Message-ID is found elsewhere.

---

## 9. Moved-message recovery

1. Worker GET by folder/uid → 404 or content mismatch.  
2. If Message-ID known → folder-scoped `POST .../folders/{folder}/messages/search` (and configured folder list as needed).  
3. Exactly one hit → update folder/uid locators; continue same idempotent path.  
4. Zero / many / uncertain → **HOLD** (`message_moved_uncertain`) + `automation_errors` + internal HOLD notify.  
5. Never create a second identity from new folder/uid alone.

---

## 10. Explicit non-calls in Pass 1

- `POST /api/v1/mailboxes/{mailboxResourceId}/send` — Stage 2 only; not built.  
- Delete / bulk delete / move — not required for Pass 1 intake.  
- Creating production webhooks — forbidden until Pre-webhook gate.  
- Any Hostinger call on the **fast ACK** path — forbidden.

---

## 11. MUST_CAPTURE_FROM_REAL_TEST checklist

- [ ] Real `message.received` JSON paths (mailboxResourceId, folder, uid as number, Message-ID, event type)  
- [ ] Inbound Authorization header exactness  
- [ ] Folder encoding edge cases  
- [ ] Search request body for Message-ID  
- [ ] `listMessages` sort/pagination/date fields for reconcile lookback  
- [ ] Authentication-Results / SPF/DKIM/DMARC exposure on meta or source (for form trust **and** form_auth_failure HOLD)  
- [ ] Whether webhook always includes Message-ID / Date (irrelevant for fast-path identity; relevant for fixtures)  
- [ ] Which folders to scan on move recovery  
- [ ] 401/403/404/429/5xx behavior under load  
