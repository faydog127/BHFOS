# 09 — Staging Safety Gate (Pass 1 v5)

**Pointer:** [`../staging-plan/PLAN_LOCKED.md`](../staging-plan/PLAN_LOCKED.md)  
**Status:** Gates **CLOSED** until required items PASS + Founder sign-off  
**Rule:** Split gates — **Section A** before any Pass 1 DDL/role; **Section B** before Hostinger webhook traffic / controlled testing activation.

| Project | Ref |
|---------|-----|
| Staging | `glkrykpksbsqmmilmjhs` |
| Production | `wwyxohjnyqnegzbxtuxs` (read-only SoR) |

**Active design pack:** `pass1-v5/` (not `pass1/` … `pass1-v4/` as implement source)

---

# Section A — Pre-build gate

**Must PASS before:** creating `n8n_email_automation`, applying `02-email-automation-schema.sql`, or any Pass 1 DDL on staging.

## A1 — Scope freeze (v5)

- [ ] Active design pack is **`pass1-v5/`**
- [ ] Pass 1 = intake + identity + routing + logging + recovery only
- [ ] Pass 2 (AI / knowledge grounding / drafting / validation / human review) **not** in this pack
- [ ] **No** `email_responses` / `email_send_queue` tables or worker stubs
- [ ] No parallel `knowledge_*` tables
- [ ] Email state only under private schema **`email_automation`**
- [ ] Shared refs only under **`integrations.external_references`** (`entity_id` text)
- [ ] Every `email_automation` row requires **`tenant_id='tvg'`**
- [ ] Fast path **fetch-free**; queue keyed on webhook pointer; identity on `email_events`
- [ ] `auto_send_enabled=false`; HCP zero writes; Lessen via `email_filter_lists` → `system_lessen`
- [ ] `known_form_senders` seeded empty; Auth-Results SPF+DKIM+DMARC required before form trust
- [ ] Form allowlisted + auth fail → **HOLD** `form_auth_failure` (never filtered)
- [ ] Production-realistic `open_lead_statuses` allowlist (excludes `Customer` / terminals) — Founder/CC-confirmable
- [ ] Kill switch `intake_processing_enabled` present; resume for `deferred_kill_switch` defined; does not change Hostinger webhooks
- [ ] Stale mid-processing → HOLD for review; never silent retry into send
- [ ] Atomic claim (`FOR UPDATE SKIP LOCKED`) + documented queue terminal states
- [ ] Trusted Reply-To only for approved form senders (after auth); ordinary cross-domain Reply-To mismatch → HOLD (PSL)
- [ ] Message-ID primary on events; fallback hash includes Date + body hash; excludes folder/UID/received_at
- [ ] Folder-scoped search: `POST .../folders/{folder}/messages/search`
- [ ] Reconcile lists recent INBOX and enqueues gaps via same idempotent path
- [ ] n8n role `n8n_email_automation` (not `service_role`); complete RLS policies incl. **contacts/leads SELECT**
- [ ] Bootstrap order reviewed (`11-bootstrap-order.md`) — no forward-reference failures
- [ ] Internal notify/digest destinations Erron-approved only (no customer addresses) — destinations may still be null at Pre-build
- [ ] pg_cron copies inactive; reconcile/digest are n8n Schedules designed but **inactive** until authorized

## A2 — Preserve & staging baseline

- [ ] `public.network_os_assurance_delivery_claims` untouched
- [ ] Staging emptiness / baseline reviewed (**contacts/leads present** for FKs)
- [ ] No production secrets / no production Edge Functions deployed for this workstream

## A3 — Inventory / neutralization

- [ ] Production read-only inventory complete or Founder-waived
- [ ] Staging outbound neutralization complete or Founder-waived
- [ ] n8n dependency on staging project resolved (yes/no)

## A4 — Ready-to-apply packet (still not applied)

- [ ] Apply packet = role + `email_automation` + `integrations.external_references` + grants + **complete RLS** (incl. contacts/leads SELECT policies) only
- [ ] Order follows `11-bootstrap-order.md`
- [ ] PRIVATE schema: real REVOKE PUBLIC/anon/authenticated; grant `n8n_email_automation` (+ service/migration as needed)
- [ ] Seeds: `auto_send_enabled=false`, kill switch, hold policies incl. `hold_on_form_auth_failure`, filter lists, `known_form_senders` **empty**, open-lead allowlist, notify destinations null until Erron sets+tests
- [ ] CRM FKs `ON DELETE SET NULL` (real statements)
- [ ] `uid` bigint; `external_references.entity_id` text
- [ ] **Do not apply** until Founder explicitly authorizes staging migrate

## A — Pre-build verdict

| Field | Value |
|-------|-------|
| Overall | ☐ PASS / ☐ FAIL / ☐ WAIVED (Founder) |
| Blockers | |
| Date (ET) | |
| Founder | |
| Coordinator | |

**After Section A PASS:** may apply schema/role on staging per `11-bootstrap-order.md`. Hostinger webhook traffic remains **OFF**. n8n schedules remain **inactive**.

---

# Section B — Pre-webhook gate

**Must PASS before:** pointing Hostinger `message.received` at n8n, enabling Hostinger webhook traffic, or activating TVG Email intake/reconcile/digest schedules for controlled testing.

## B1 — Notification destination set + tested

- [ ] `review_notify_destination` set to Erron-approved internal email or Slack (not null)
- [ ] `daily_filtered_digest_destination` set to Erron-approved internal destination (not null) **or** Founder-waived if digest deferred
- [ ] Test HOLD/error notification delivered successfully to that destination (record evidence in staging notes)
- [ ] Test digest path dry-run or sample delivered (or Founder waiver)
- [ ] `review_notify_enabled` / digest enable flags remain false until test passes, then may enable for controlled testing only
- [ ] Confirmed destinations are **not** customer addresses and are not derived from message From/Reply-To

## B2 — Intake readiness for controlled testing

- [ ] Section A (Pre-build) already PASS and schema/role applied on staging
- [ ] `n8n_email_automation` can SELECT `contacts`/`leads` under RLS (verification query)
- [ ] Kill switch verified: `intake_processing_enabled=false` parks without changing Hostinger webhook config; resume `deferred_kill_switch` → `pending` works in dry run
- [ ] Fast ACK workflow imported **inactive**; Bearer secret in n8n Credentials only
- [ ] Worker claim path uses atomic `FOR UPDATE SKIP LOCKED` (or `claim_intake_batch`)
- [ ] Synthetic fixtures F1–F19 planned / partially runnable with mocks
- [ ] `auto_send_enabled=false` re-confirmed
- [ ] No `email_responses` / `email_send_queue` present

## B3 — Non-enablement / controlled-enable checklist

- [ ] Hostinger `message.received` webhook **not** pointed at n8n until this section PASSes
- [ ] After PASS: enable only for **controlled testing** with Founder OK (document window)
- [ ] n8n TVG Email workflows remain inactive until Founder authorizes activation
- [ ] Stage 2 sender **not** deployed
- [ ] AI / drafting / knowledge-for-response / validation **not** enabled
- [ ] Acknowledgments **not** sent
- [ ] Production `wwyxohjnyqnegzbxtuxs` **not** mutated

## B — Pre-webhook verdict

| Field | Value |
|-------|-------|
| Overall | ☐ PASS / ☐ FAIL / ☐ WAIVED (Founder) |
| Blockers | |
| Notification test evidence | |
| Kill-switch test evidence | |
| Date (ET) | |
| Founder | |
| Coordinator | |

**After Section B PASS:** controlled Hostinger webhook enable + inactive→active n8n schedules only as Founder authorizes. Still no customer sends. Still no production mutations.
