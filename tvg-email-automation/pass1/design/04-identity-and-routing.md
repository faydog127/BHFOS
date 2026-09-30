# 04 — Identity and Routing (Pass 1 v5)

**Status:** DESIGN REVIEW ONLY — design only  
**LOCKED:** Contact-first; case-insensitive email; phone conflict = phone hits contact with different email → HOLD; **production-realistic** open leads.status allowlist; PSL registrable-domain; form trust (empty seed + Auth-Results); **form auth fail → HOLD (not filtered)**; filter lists table; tenant `tvg`

---

## 1. Tenant rule (absolute)

Every `email_automation.*` row **must** carry **`tenant_id = 'tvg'`** (DEFAULT + CHECK + application writes).  
CRM reads for matching filter `tenant_id = 'tvg'` where the column exists.  
Never match or write under another tenant.

---

## 2. Contact-first identity

| Entity | Meaning | FK on `email_events` | On delete |
|--------|---------|----------------------|-----------|
| `contacts` | Person | `contact_id` | **`ON DELETE SET NULL`** |
| `leads` | Opportunity | `lead_id` | **`ON DELETE SET NULL`** |

**No new property FK architecture** in Pass 1. Pass 1 **does not create** CRM rows.

### Matching order

1. Resolve customer email via recipient rules (§6–§7).
2. **Case-insensitive** normalized email match on `contacts` within `tvg` → set `contact_id`.
3. If exactly one unambiguous **open** `leads` row for that contact (see §5) → set `lead_id`.
4. Multiple contacts for same email → **HOLD** (`ambiguous_contact`).
5. Phone conflict (§4) → **HOLD** (`phone_conflict`).
6. Cross-tenant hit → **HOLD** (`cross_tenant_match`); do not link.
7. No match → leave FKs null; may still reach `awaiting_pass2`.

---

## 3. Case-insensitive email matching

Against existing CRM rows:

1. Trim whitespace.  
2. Lowercase entire address (Unicode default casefold / lower).  
3. Reject if missing `@`, empty local/domain, or spaces.  
4. Match with **case-insensitive equality**, e.g. `lower(contacts.email) = normalized_customer_email` (and same for `leads.email` when used).  
5. No fuzzy / partial / domain-only matching.  
6. Store raw + normalized where schema allows (`from_email`, `resolved_recipient`, etc.).

---

## 4. Phone conflict → HOLD (revised)

**Rule (Founder):** Phone conflict = normalized phone from form/body/signature **matches an existing `contacts` row** whose **email differs** from the resolved customer email → **HOLD** (`hold_reason = phone_conflict`).

| Situation | Action |
|-----------|--------|
| Phone matches contact A; contact A email equals resolved customer email (case-insensitive) | Not a conflict; may reinforce contact link |
| Phone matches contact A; contact A email is null or **differs** from resolved customer email | **HOLD** `phone_conflict` |
| Phone matches no contact | No phone-based hold |
| Cross-tenant phone hit | **HOLD** `cross_tenant_match` |

**Removed dead rule:** “Phone matches multiple contacts” — Founder: `contacts.phone` is unique, so multiple matches cannot fire. Do not implement that branch.

Setting: `hold_on_phone_conflict=true`.

---

## 5. Open `leads.status` values (production-realistic)

### Inventory evidence (READ-ONLY under `staging-plan/`)

| Source | Finding |
|--------|---------|
| `staging-plan/work/01-enums.sql` | `lead_status_enum = 'new' \| 'contacted' \| 'qualified' \| 'escalated'` |
| `staging-plan/work/03-tables-01.sql` | `public.leads.status` is **`text DEFAULT 'new'`** (not constrained to the enum) |
| `staging-plan/work/config-copy/sql/proof_fixtures.sql` | Sets `leads.status = 'Customer'` (converted / terminal) |
| `staging-plan/inventory/06-outbound-edge-invocation-map.md` | QB sync trigger fires when lead status = **`Customer`** |
| Production distinct-status census | **Thin / not captured** in on-disk inventory |

**v4 defect (Command Center):** Treating the full staging enum as “open” is not production-realistic — CRM free-text includes terminal values (at least `Customer`) that must **not** auto-link.

### Pass 1 open-lead **allowlist** (proposed — Founder/CC-confirmable)

```json
["new", "contacted", "qualified", "escalated"]
```

Stored in `automation_settings.open_lead_statuses`. Matching is **case-insensitive** against `leads.status`.  
**Allowlist-only:** any status **not** on this list does **not** auto-link `lead_id` (including unknowns).

### Explicitly **not open** (do not auto-link)

| Status | Basis |
|--------|-------|
| `Customer` | Inventory-backed terminal / converted |
| `closed`, `won`, `lost`, `abandoned`, `cancelled`, `archived`, `disqualified` | Proposed terminal/closed set — **Founder/CC-confirmable** if used in production free-text |

### Confirm before implement

1. Optional read-only census of distinct `leads.status` on production SoR (`wwyxohjnyqnegzbxtuxs`) — Founder-authorized inventory only.  
2. Confirm whether `escalated` remains open (design default: **yes**, still in pipeline).  
3. Add any additional active-pipeline labels Founder wants; never add `Customer` / closed terminals to the allowlist.

---

## 6. Known website-form sender allowlist + Auth-Results

Table: `email_automation.known_form_senders` (`tenant_id='tvg'`).

| Field | Role |
|-------|------|
| `from_email` | Exact normalized From treated as form/system handoff |
| `enabled` | Must be true |
| `trust_reply_to` | If true, Reply-To may be trusted **only** for this allowlisted From |
| `require_auth_results` | Default true |

**Seed: EMPTY.** Do not insert `info@vent-guys.com` until captured from **real form samples**.  
**Never** treat mail as a form submission solely because From is our own mailbox.

### Trust gate (required before any form trust)

Setting `form_require_auth_results_pass=true` (default). Worker must parse `Authentication-Results` (or equivalent Hostinger-exposed auth fields — **MUST_CAPTURE_FROM_REAL_TEST**) and require:

| Check | Required |
|-------|----------|
| SPF | pass |
| DKIM | pass |
| DMARC | pass |

### Form auth failure → HOLD (Command Center item 3) — LOCKED

When From matches an **allowlisted** form sender (enabled) **or** an otherwise identified form path, **but** SPF/DKIM/DMARC (Authentication-Results) fail / missing / softfail / temperror:

| Outcome | Required |
|---------|----------|
| `email_events.status` | **`held`** |
| `hold_reason` | **`form_auth_failure`** |
| `intake_queue.status` | **`held`** |
| Filter path | **FORBIDDEN** — must **never** become `filtered` |
| Self-mail deny | **Do not** apply as a silent filter escape hatch for this case |
| Notify | Internal HOLD notify (when enabled) |

Setting: `hold_on_form_auth_failure=true`.

Store `spf_pass` / `dkim_pass` / `dmarc_pass` / raw `authentication_results` on `email_events`.

When From is allowlisted **and** auth gate passes: do not apply `self_mail` deny solely because From is the mailbox; resolve customer via trusted Reply-To and/or deterministic form field extraction.

---

## 7. Reply-To trust rules + PSL (LOCKED)

### Registrable-domain comparison

Use a **public-suffix list** (PSL), e.g. Mozilla PSL via a maintained library (`psl` / `publicsuffix2` / equivalent), to extract registrable domain (eTLD+1):

- `mail.example.co.uk` → `example.co.uk`  
- `foo.vent-guys.com` → `vent-guys.com`  
- Do **not** use naive “last two labels” splitting.

Pin a PSL snapshot version in n8n dependency notes at implement time (**MUST_CAPTURE** which package/version).

### Trusted Reply-To (allowed)

Only when:

1. Normalized From is in `known_form_senders` for `tvg`, `enabled=true`, `trust_reply_to=true`, **and**
2. Auth-Results gate passes (§6), **and**
3. Reply-To is a single valid mailbox, **and**
4. Reply-To is not self/mailbox/noreply/daemon (per filter lists / rules).

→ `recipient_resolution = 'reply_to_trusted_form'`.

### Ordinary cross-domain Reply-To mismatch → HOLD

If From is **not** an approved+auth-passing form sender (or `trust_reply_to=false`), and Reply-To has a **different registrable domain** (PSL) than From:

- **HOLD** (`hold_reason = reply_to_domain_mismatch`).
- Setting `hold_on_reply_to_domain_mismatch=true`.

### Ordered recipient resolution

```
1. Allowlisted form From + auth-results FAIL/missing
   → HOLD form_auth_failure   ← NEVER filtered
2. Allowlisted form From + auth-results pass + trust_reply_to + valid Reply-To
   → Reply-To / reply_to_trusted_form
3. Allowlisted form From + auth-results pass + exactly one form-field customer email
   → form email / form_field
4. Non-allowlisted From + Reply-To registrable domain != From registrable domain
   → HOLD reply_to_domain_mismatch
5. Valid non-self/non-noreply From
   → From / from
6. Else → HOLD ambiguous_recipient
```

---

## 8. Lessen / vendor / noreply — `email_filter_lists`

All Lessen, vendor, noreply, and list patterns live in **`email_automation.email_filter_lists`**.  
**n8n must SELECT and apply this table — no hard-coded domain/noreply arrays in workflow code.**

| kind | Example seed | action |
|------|--------------|--------|
| `domain_deny` / `vendor` | `lessen.com` | `system_lessen` |
| `noreply_pattern` | `noreply`, `no-reply`, `donotreply` | `deny` → `filtered` |
| `sender_deny` | `mailer-daemon@` | `deny` |
| `list_pattern` | `list-id` | `deny` |

Lessen → `status = system_lessen` (terminal). **No** customer reply path. **No** HCP write. Not a Pass 2 draft candidate.

**Exception:** Form-auth-failure path (§6) is evaluated in recipient resolution and **overrides** any temptation to classify as self-mail `filtered`.

---

## 9. Deterministic filtering (pre-identity)

Order:

1. Header hard rules (Auto-Submitted, Precedence, list, DSN)  
2. `email_filter_lists` patterns (noreply → filtered; Lessen/vendor → `system_lessen`)  
3. Self/loop — **skip self-mail filter kill when From is allowlisted form** (auth pass → trust path; auth fail → HOLD `form_auth_failure`)  
4. Pass to recipient resolution  

Deny → `status=filtered`. No AI. No knowledge lookup for responses.

---

## 10. Staging vs production

| Project | Ref | Data |
|---------|-----|------|
| Staging | `glkrykpksbsqmmilmjhs` | Synthetic `tvg` fixtures |
| Production | `wwyxohjnyqnegzbxtuxs` | Live CRM — no Pass 1 writes |

Preserve `public.network_os_assurance_delivery_claims`.
