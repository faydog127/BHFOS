# 08 — Synthetic Fixture Plan (Pass 1 v5 — Intake Only)

**Status:** DESIGN REVIEW ONLY — design only  
**Project:** Staging `glkrykpksbsqmmilmjhs`  
**Rule:** No live customer PII required; no production mailbox fire until **Pre-webhook** gate PASS  
**Scope:** Intake-only fixtures. **No** AI/draft/validation/response/send scenarios as required Pass 1 work.

---

## 1. Goals

Prove: webhook auth, durable-before-2xx, **fetch-free** pointer idempotency, kill switch + resume, **atomic claim** (two workers cannot take same row), worker fetch + identity (Message-ID / fallback with body hash), filters via `email_filter_lists` (Lessen → `system_lessen`), empty form seed + Auth-Results gate, **form allowlisted + auth fail → HOLD (not filtered)**, Reply-To trust after allowlist+auth, cross-domain Reply-To HOLD (PSL), case-insensitive contact email link, phone≠email conflict HOLD, **production-realistic** open lead status allowlist (exclude `Customer`), tenant isolation, moved-message recovery, INBOX reconcile gap-fill, stale → HOLD, reject sampling, contacts/leads RLS SELECT works for n8n role, internal notify/digest wiring (destination Erron-approved, set+tested or mocked).

---

## 2. Naming

| Field | Pattern |
|-------|---------|
| Email | `*@example.com` / `*@invalid` |
| Name | Prefix `SYNTH ` |
| Phone | `555-01xx` |
| Message-ID | `<synth-pass1-{uuid}@vent-guys.test>` |
| tenant_id | `tvg` only |

---

## 3. Fixture sets (required)

| ID | Scenario | Expect |
|----|----------|--------|
| F1 | Happy path customer | pointer queue → atomic claim → worker → `awaiting_pass2`; `tenant_id=tvg` |
| F2 | Duplicate webhook (same pointer) | one queue row; second 2xx duplicate; one `email_events` after worker |
| F3 | Fallback hash (no Message-ID; body norm stable across two fetches) | single `fallback_hash`; same hash on re-fetch |
| F4 | Form path: allowlist row + Auth-Results all pass | Reply-To/form trust; not self-mail kill |
| F4b | From=mailbox but **not** on allowlist (empty seed default) | **Not** treated as form; ordinary rules / HOLD as applicable |
| F4c | Allowlisted From but SPF/DKIM/DMARC fail | **`held` / `form_auth_failure` — NOT `filtered`** |
| F5 | Lessen via `email_filter_lists` | `system_lessen`; no customer path; no HCP write |
| F6 | Phone conflict: synth contact phone matches, email differs | HOLD `phone_conflict` |
| F7 | Cross-tenant isolation | no link to non-tvg contact |
| F8 | Message moved (404 → search one hit) | locators updated; continue |
| F9 | Auth failure | 401/403; no intake row (or auth sample only) |
| F10 | `auto_send_enabled=false` guard | no send artifacts; no Hostinger send; no response rows |
| F11 | Kill switch off | park `deferred_kill_switch`; webhook config untouched; no worker process; no fetch on ACK |
| F11b | Kill switch resume | `deferred_kill_switch` → `pending` → worker processes |
| F12 | Ordinary cross-domain Reply-To mismatch (PSL) | HOLD `reply_to_domain_mismatch` |
| F13 | Stale processing TTL | HOLD `stale_processing`; queue status `held`; never silent path to send |
| F14 | Rejected webhook sampling | samples capped per hour setting |
| F15 | Reconcile INBOX gap-fill | listed message missing from events → enqueued via pointer path |
| F16 | Case-insensitive email match | `Contact@Example.com` links to CRM `contact@example.com` |
| F17 | Open lead status allowlist | lead `new`/`contacted`/`qualified`/`escalated` may link; **`Customer` does not** auto-link; other non-allowlist statuses do not |
| F18 | Concurrent workers | two claim attempts on one `pending` row → exactly one wins (`SKIP LOCKED`); loser gets no row |
| F19 | n8n RLS on contacts/leads | as `n8n_email_automation`, SELECT returns tvg rows; no INSERT/UPDATE permitted |

---

## 4. Explicitly out of scope for Pass 1 fixtures

- AI classification / drafting  
- Knowledge grounding for replies  
- Response validation / human draft review  
- Customer-facing sends / acks  
- Creating `email_responses` / `email_send_queue` rows  

---

## 5. Hostinger dependency

Prefer recorded webhook JSON fixtures until real capture authorized post **Pre-webhook** gate. Mock worker Hostinger calls in unit tests. Preserve `network_os_assurance_delivery_claims`.

---

## 6. Cleanup

Delete/mark synth rows by Message-ID prefix / `SYNTH` markers. Do not use production `service_role` for mass-delete.
