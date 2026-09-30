# The Vent Guys — Automated Email Response System
## Pass 1 Design Pack v5 (Intake-Only — DESIGN REVIEW ONLY)

**Status:** DESIGN REVIEW ONLY — design only.  
**Do not** apply SQL, touch Supabase, enable Hostinger/n8n, implement workflows, or mutate staging/production from this pack.

| Environment | Project ref | Role |
|-------------|-------------|------|
| **Staging** | `glkrykpksbsqmmilmjhs` | BHFOS n8n Assurance Preview → rename **TVG CRM Staging** |
| **Production** | `wwyxohjnyqnegzbxtuxs` | TVG Website-CRM — **read-only** source of CRM schema / config |

**Preserve on staging:** `public.network_os_assurance_delivery_claims` (untouched).

**Supersedes:** [`../pass1/`](../pass1/), [`../pass1-v2/`](../pass1-v2/), [`../pass1-v3/`](../pass1-v3/), and [`../pass1-v4/`](../pass1-v4/) for implementation intent.  
**Do not modify** `pass1/`, `pass1-v2/`, `pass1-v3/`, or `pass1-v4/` — leave as historical reference.

**Plan pointer:** [`../staging-plan/PLAN_LOCKED.md`](../staging-plan/PLAN_LOCKED.md)  
**Binding brief:** [`../staging-plan/FOUNDER_BRIEF_PASS1_2026-09-24.md`](../staging-plan/FOUNDER_BRIEF_PASS1_2026-09-24.md)  
**Staging safety gate:** [`09-staging-safety-gate.md`](./09-staging-safety-gate.md) (Section A Pre-build / Section B Pre-webhook)  
**Bootstrap order:** [`11-bootstrap-order.md`](./11-bootstrap-order.md)  
**Change log vs v4:** [`10-change-log-vs-v4.md`](./10-change-log-vs-v4.md)

---

## Phase boundary (LOCKED)

| Phase | In scope | Out of scope for this pack |
|-------|----------|----------------------------|
| **Pass 1** | Intake + identity + routing + logging + recovery (webhook auth, durable queue, fetch/filter/resolve/link, HOLD/error notify, daily filtered digest, stale-intake HOLD recovery, kill switch + resume, reconcile via same idempotent path incl. INBOX gap-fill) | AI, drafting, knowledge grounding for replies, validation, human draft review, **draft/response tables**, **send queue**, customer auto-send |
| **Pass 2** | AI classification + knowledge grounding + drafting + validation + human review | (separate design pack) |

Pass 1 ends at: durable intake logged → filtered **or** linked / HOLD → notifications/digest designed → status **`awaiting_pass2`**. **No draft generation. No `email_responses` / `email_send_queue`.**

---

## Standing rules (LOCKED — must hold for all Pass 1 work)

1. **`auto_send_enabled = false`** at all times in Pass 1 / Stage 1.
2. **No HCP writes.**
3. **“Cron disabled”** means copied production **pg_cron** jobs only — keep them inactive. Reconciliation sweep and daily filtered-message digest use **n8n Schedule triggers**. Those workflows are **designed as part of this Pass 1 package** but schedules stay **inactive** until controlled testing is authorized by Founder.
4. **No production secrets / no production Edge Functions.**
5. **No customer-facing sends** (including acknowledgments).
6. **Hostinger webhook traffic OFF** until an approved intake workflow is ready for controlled testing (**Pre-webhook gate**).
7. Staging `glkrykpksbsqmmilmjhs`; Production SoR `wwyxohjnyqnegzbxtuxs` read-only source.
8. **Preserve** `network_os_assurance_delivery_claims`.
9. Every `email_automation` row **must** explicitly carry **`tenant_id = 'tvg'`**.
10. **Single operational kill switch** (`intake_processing_enabled`) stops intake processing **without** removing or changing Hostinger webhook configuration. Resume behavior for parked rows is defined in `06`.
11. Stale mid-processing events → **HOLD** and surface for review; **never** silently retry into any future send path.
12. Internal notifications (HOLD/error + daily digest) may send **only** to an Erron-approved internal destination (his email or approved Slack). **No** path may resolve to or send to a customer address.
13. **Notification destination must be set and tested** before controlled testing begins (**Pre-webhook gate** item).
14. Fast path is **fetch-free**; worker alone computes canonical identity.
15. **Grants alone are insufficient** — complete RLS policies required for every table `n8n_email_automation` touches, including **`public.contacts` / `public.leads`** (SELECT).
16. Website-form From allowlisted but Authentication-Results fail → **HOLD** (`form_auth_failure`), **never** `filtered`.
17. Worker dequeue uses **atomic claim** (`FOR UPDATE SKIP LOCKED`); `intake_queue` terminal states are documented and consistent.

---

## Pass 1 MUST INCLUDE (documented in this pack)

| # | Requirement | Primary doc |
|---|-------------|-------------|
| 1 | `email_automation` **private** schema with real REVOKE/GRANT | `02`, `11` |
| 2 | `integrations.external_references` (`entity_id` text) + complete RLS | `02`, `03` |
| 3 | Real CRM FKs to `contacts` / `leads` with **`ON DELETE SET NULL`** | `02` |
| 4 | Canonical contact-first identity; case-insensitive email match | `04` |
| 5 | Phone conflict → HOLD (phone matches contact with different email) | `04` |
| 6 | Production-realistic open `leads.status` allowlist (excludes terminal) | `04`, `02` setting |
| 7 | Registrable-domain compare via public-suffix list | `04` |
| 8 | Tenant-aware matching (`tvg` only) | `04` |
| 9 | Lessen / vendor via configurable `email_filter_lists` (no hard-coded n8n lists) | `02`, `04` |
| 10 | `known_form_senders` seeded **empty**; SPF/DKIM/DMARC pass required before trust | `02`, `04` |
| 11 | Form allowlisted + auth fail → **HOLD** (not filtered) | `04`, `08` |
| 12 | Trusted Reply-To only for approved form senders (after auth results) | `04` |
| 13 | Ordinary cross-domain Reply-To mismatch → HOLD | `04` |
| 14 | Hostinger webhook authentication | `05`, `06` |
| 15 | Durable intake before acknowledgment | `01`, `05`, `06` |
| 16 | Fast/async webhook 2xx; **fetch-free** fast path keyed on webhook pointer | `01`, `06`, `07` |
| 17 | Corrected folder-scoped Hostinger message search | `05` |
| 18 | Authoritative message fetch (worker only) | `05`, `06` |
| 19 | Message-ID as durable identity on `email_events` | `07` |
| 20 | Fallback hash: mailbox + sender + recipient + subject + Date + **body hash** (precise norm) | `07` |
| 21 | Moved-message recovery | `05`, `06` |
| 22 | Deterministic filtering via `email_filter_lists` | `04`, `06` |
| 23 | Recipient + CRM identity resolution | `04`, `06` |
| 24 | Intake/event logging | `02`, `06` |
| 25 | HOLD/error notifications (Erron-approved internal only) | `06` |
| 26 | Daily filtered-message digest (Erron-approved internal only) | `06` |
| 27 | 10–15 min reconcile: stale HOLD + **list recent INBOX gap-fill** via same idempotent path | `06`, `05` |
| 28 | Rejected-webhook rate limiting/sampling | `06` |
| 29 | Dedicated least-privilege n8n DB role | `03` |
| 30 | Explicit `tenant_id = 'tvg'` on every `email_automation` row | `02`, `04` |
| 31 | Stale-intake recovery → HOLD + review; never silent retry into send | `06`, `07` |
| 32 | Operational kill switch + **defined resume** for parked rows | `02`, `06` |
| 33 | Complete RLS policies for every table `n8n_email_automation` touches **incl. contacts/leads** | `02`, `03` |
| 34 | Executable bootstrap order (no forward-reference failures) | `11`, `02` |
| 35 | Split Pre-build vs Pre-webhook safety gates | `09` |
| 36 | Atomic worker claim + consistent queue terminal state machine | `02`, `06`, `01` |

---

## Pass 1 MUST NOT INCLUDE

- AI classification / drafting
- Knowledge lookup for response generation
- Response validation / human draft review
- **`email_responses` table / draft infrastructure**
- **`email_send_queue` / customer auto-send**
- Hard-coded Lessen/noreply lists inside n8n (use `email_filter_lists`)
- Silently filtering form-looking mail that fails Authentication-Results

---

## Document index (v5)

| # | File | Purpose |
|---|------|---------|
| 1 | [01-architecture.md](./01-architecture.md) | Mermaid: fetch-free fast path + worker identity; atomic claim; form-auth HOLD; no response/send |
| 2 | [02-email-automation-schema.sql](./02-email-automation-schema.sql) | Full DDL ordered for bootstrap; contacts/leads RLS; claim helpers comments |
| 3 | [03-n8n-role.md](./03-n8n-role.md) | Grants + RLS matrix incl. contacts/leads SELECT policies |
| 4 | [04-identity-and-routing.md](./04-identity-and-routing.md) | Open-status allowlist; form auth fail → HOLD; phone/PSL/filters |
| 5 | [05-hostinger-endpoints.md](./05-hostinger-endpoints.md) | Webhook/fetch/search + list recent INBOX for reconcile |
| 6 | [06-n8n-intake-worker-reconcile.md](./06-n8n-intake-worker-reconcile.md) | Atomic claim; status machine; worker/reconcile/kill-switch |
| 7 | [07-idempotency.md](./07-idempotency.md) | Pointer uniqueness; fallback hash + body normalization |
| 8 | [08-synthetic-fixture-plan.md](./08-synthetic-fixture-plan.md) | Intake-only fixtures incl. F4c form-auth HOLD |
| 9 | [09-staging-safety-gate.md](./09-staging-safety-gate.md) | **Section A Pre-build** / **Section B Pre-webhook** |
| 10 | [10-change-log-vs-v4.md](./10-change-log-vs-v4.md) | Delta vs pass1-v4 — Command Center items 1–6 |
| 11 | [11-bootstrap-order.md](./11-bootstrap-order.md) | Executable apply order (extensions → … → seeds) |

---

## How to use (after Founder/Command Center approval of this design)

1. Keep Hostinger webhook traffic **OFF** and n8n email workflow **schedules inactive**.
2. Pass **Section A (Pre-build)** of [`09-staging-safety-gate.md`](./09-staging-safety-gate.md) before any Pass 1 DDL / role create.
3. Apply schema only per [`11-bootstrap-order.md`](./11-bootstrap-order.md) after Founder authorizes staging migrate.
4. Pass **Section B (Pre-webhook)** before enabling Hostinger webhook traffic or activating intake schedules.
5. Implement from **`pass1-v5/`** only — never from older `pass1*` trees as the active design.
6. Leave prior packs as historical reference; do not edit them for this revision.
