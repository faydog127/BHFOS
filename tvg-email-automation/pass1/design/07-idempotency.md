# 07 — Idempotency (Pass 1 v5)

**Status:** DESIGN REVIEW ONLY — design only  
**LOCKED:** Queue uniqueness = webhook pointer; `email_events` uniqueness = Message-ID or fallback hash; fallback includes **precise body hash**; folder/UID locators only; stale → HOLD (never silent send retry)  
**Supersedes:** `pass1-v4/07-idempotency.md` — BodyNormalization v1 / fallback hash v2 **unchanged**; queue claim concurrency documented in `06`

---

## 1. Goals

- Duplicate Hostinger webhooks must not fork processing.  
- Fast path ACKs after a **durable** unique **pointer** write with `tenant_id='tvg'` — **fetch-free**.  
- Folder+UID are **secondary locators** only; durable identity lives on `email_events`.  
- Two Hostinger fetches of the **same** message must produce the **same** fallback hash.

---

## 2. Fast path: pointer uniqueness on `intake_queue`

| Key | Columns |
|-----|---------|
| Unique index | `(tenant_id, mailbox_resource_id, folder, uid)` |
| Identity on insert | `message_id` NULL, `fallback_hash` NULL |

1. Insert-first on pointer.  
2. Unique violation → duplicate → **2xx** / no reprocess.  
3. **No** Hostinger fetch; **no** Message-ID/fallback computation on fast path.  
4. Never invent identity from pointer alone for `email_events`.

---

## 3. Primary durable identity: Message-ID on `email_events`

1. Worker prefers RFC Message-ID from authoritative Hostinger `/source` (or metadata).  
2. Normalize: trim; strip surrounding `<>` for storage key (keep original in `hostinger_pointers`).  
3. Unique: `(tenant_id, mailbox, message_id)` WHERE message_id IS NOT NULL.  
4. Insert-first / upsert; unique violation → link existing event; do not fork.  
5. Never invent a fake RFC Message-ID.  
6. Update `intake_queue.message_id` after computation.

---

## 4. Fallback hash (Message-ID missing)

Enabled via `idempotency_fallback_enabled` (default true). Computed **only by worker** after authoritative fetch.

### 4.1 Formula (v2)

```
canonical = join components with ASCII unit separator U+001F (0x1F):

  mailbox                         # exact mailbox address string used in SoT, e.g. info@vent-guys.com
  + normalized_sender             # §4.2
  + normalized_recipient          # §4.2 — primary To mailbox if present, else ""
  + normalized_subject            # §4.3
  + date_header                   # §4.4
  + body_hash                     # §4.5 — 64 lowercase hex chars

# EXCLUDED (do NOT include):
#   folder, uid, received_at / webhook_received_at, tenant_id, random nonce,
#   Message-ID, Authentication-Results, raw HTML

fallback_hash = "v2:" + lowercase_hex( SHA-256( UTF-8 bytes of canonical ) )
```

Unique on `email_events`: `(tenant_id, mailbox, fallback_hash)` WHERE fallback_hash IS NOT NULL.

**Why body hash:** without Message-ID, Date+envelope alone can collide; body content stabilizes identity across redeliveries.  
**Why exclude folder/UID:** moves must not create a second identity.  
**Why exclude receipt time:** changes on redelivery.

### 4.2 Normalized sender / recipient (email)

1. If raw address missing → `""`.  
2. Extract addr-spec if display-name form (`Name <user@dom>` → `user@dom`).  
3. Trim ASCII whitespace.  
4. Lowercase with Unicode default case mapping.  
5. If invalid (no `@`, empty local/domain, contains space) → use `""` for hash component (still HOLD later for routing if needed).

### 4.3 Normalized subject

1. If missing → `""`.  
2. Unicode **NFC**.  
3. Trim leading/trailing Unicode whitespace (categories Zs + ASCII space/tab/CR/LF).  
4. Replace any internal run of whitespace (Zs, `\t`, `\n`, `\r`, `\f`, `\v`) with a **single** ASCII space `0x20`.  
5. Lowercase with Unicode default case mapping.

### 4.4 Date header

1. Prefer the exact `Date:` header value from authoritative `/source`, after: trim leading/trailing whitespace; Unicode NFC; collapse internal whitespace runs to single space (same rule as subject step 4, but **do not** lowercase — preserve RFC822 case of tokens).  
2. If Date header absent → `""` (degrades collision resistance; still include body_hash).  
3. Do **not** convert to epoch in v2 (avoids parser divergence). Store raw-normalized string also in `email_events.message_date_header`.

### 4.5 Body normalization + body_hash (PRECISE — BodyNormalization v1)

Goal: repeated Hostinger fetches of the same message → identical `body_hash`.

#### Step A — Select body source

1. Prefer **text/plain** content from `GET .../messages/{uid}/text` when the API returns a plain-text part / field.  
   - If the text endpoint returns both plain and HTML, take plain only.  
   - Prefer the first non-empty plain part if multipart.  
2. Else if only HTML is available (from text endpoint HTML field or HTML extracted from `/source`): run **HtmlToText v1** (Step B) on that HTML string.  
3. Else → body string is empty `""`.

Do not concatenate plain+HTML. Do not include attachment bytes.

#### Step B — HtmlToText v1 (only when Step A chose HTML)

Operate on a Unicode string (decode HTML bytes as UTF-8; on decode error use replacement U+FFFD consistently — prefer treating Hostinger payload as UTF-8).

1. Unicode NFC the HTML string.  
2. Remove `script` and `style` elements: case-insensitive match of  
   `<script\b[^>]*>[\s\S]*?</script>` and `<style\b[^>]*>[\s\S]*?</style>` (non-greedy), iteratively until no match.  
3. Replace the following opening/closing tags with a single `\n` (case-insensitive):  
   `<br\s*/?>`, `</p>`, `</div>`, `</tr>`, `</li>`, `</h1>`…`</h6>`, `</table>`, `</blockquote>`.  
4. Strip all remaining tags: replace `/<[^>]+>/g` with empty string.  
5. Decode character references in this order:  
   - Named: `&nbsp;` → U+0020; `&amp;` → `&`; `&lt;` → `<`; `&gt;` → `>`; `&quot;` → `"`; `&apos;` / `&#39;` → `'`.  
   - Numeric decimal `&#N;` and hex `&#xH;` → corresponding Unicode code point if N is in range 0x09,0x0A,0x0D or ≥0x20 and ≤0x10FFFF excluding surrogates; otherwise drop the reference.  
6. Proceed to Step C with the resulting text.

#### Step C — Line ending + whitespace normalize (plain or HtmlToText output)

1. Unicode **NFC**.  
2. Normalize newlines: replace `\r\n` → `\n`, then remaining `\r` → `\n`.  
3. For **each line** (split on `\n`, keep empties): remove **trailing** characters that are U+0020, U+0009, U+000B, U+000C, or U+00A0.  
   - Do **not** trim leading whitespace on the line.  
   - Do **not** collapse internal spaces/tabs within the line.  
4. Join lines with `\n`.  
5. Collapse runs of **3+** consecutive `\n` into exactly **2** `\n` (i.e. max one blank line between paragraphs).  
6. Remove leading `\n` and trailing `\n` from the whole string (result may be `""`).

#### Step D — Hash

```
body_bytes = UTF-8 encode of Step C string (no BOM)
body_hash  = lowercase hex( SHA-256(body_bytes) )   # exactly 64 chars
```

Store `body_hash` on `email_events`. Use it as the last component of the fallback canonical string.

#### Stability notes

- Worker must use the same Hostinger endpoints and the same Steps A–D on every fetch.  
- Do not include multipart boundaries, MIME headers, or attachment filenames in the body string.  
- If Hostinger `/text` vs `/source` diverge, **prefer `/text` plain** per Step A so both worker and reconcile use one source of truth.

---

## 5. Fast path vs worker vs reconcile

| Phase | Action |
|-------|--------|
| Fast ACK | Insert `intake_queue` on pointer only; 2xx; no fetch |
| Worker | Fetch → Message-ID or v2 fallback_hash → upsert `email_events`; link queue |
| Duplicate webhook (same pointer) | Unique hit on queue → 2xx |
| Same Message-ID, new folder/UID | Update locators only on existing `email_events` |
| Reconcile gap-fill | List INBOX → enqueue missing pointers via same queue uniqueness |
| Reconcile stale | HOLD; never silent send path |

**Upgrade path:** when Message-ID later appears on a fallback-only row, set if null; if another row owns it → HOLD (`message_id_conflict`).

---

## 6. Stale-intake recovery (Founder binding)

If a row remains `processing` past `stale_processing_ttl_minutes`:

1. Set status **HOLD** (`stale_processing`).  
2. Surface via internal HOLD notify + `automation_errors`.  
3. **NEVER** silently re-queue into a flow that can later send (Pass 1 has no send tables; still forbid any future silent promotion).  
4. Any retry requires explicit human/ops action that still uses the same idempotent pointer / identity keys.

---

## 7. Stage 2 reminder

Send idempotency is separate. Pass 1 does not send and has no `email_send_queue`. Webhook retries must never cause `POST /send`.
