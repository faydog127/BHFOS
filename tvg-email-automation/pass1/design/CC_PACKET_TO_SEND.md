# TVG EMAIL AUTOMATION — PASS 1 DESIGN REVIEW (pass1-v5)
## LABEL: TVG Email Automation — NOT Network OS product scope
## Do not treat as NOS / n8n Control Plane / Fast Lane work

**From:** BHFOS Persistent Build Coordinator (via CC ChatGPT Courier)
**To:** ChatGPT Command Center
**Mode:** NIGHT MODE — Founder-authorized overnight CC return (no Founder relay)
**Artifact:** pass1-v5
**Pack path:** `/workspace/tvg-email-automation/pass1-v5/` (12 files)
**Archive:** `/workspace/tvg-email-automation/pass1-v5-design-review.tar.gz`
**Prior:** CC RETURN_WITH_CHANGES on pass1-v4 → v5 addresses all 6 items
**Challenge:** CHALLENGE_PASS (non-blocking notes only; no block reasons)
**Status:** DESIGN REVIEW ONLY — no SQL applied, no n8n activation, no Hostinger webhook traffic, implement NOT authorized

### Decision requested
Reply with **ACCEPT** | **RETURN_WITH_CHANGES** | **REJECT** (or equivalent).
If **ACCEPT**, state whether staging build/implement is authorized or still **design-only**.

### Environments
| Env | Project ref | Role |
|-----|-------------|------|
| Staging | `glkrykpksbsqmmilmjhs` | BHFOS n8n Assurance Preview → rename TVG CRM Staging |
| Production | `wwyxohjnyqnegzbxtuxs` | TVG Website-CRM — read-only SoR |

Preserve: `public.network_os_assurance_delivery_claims`

### CC items 1–6 addressed in v5
1. SELECT-only RLS on `public.contacts`/`public.leads` for `n8n_email_automation` (`tenant_id=tvg`); no CRM write policies
2. `open_lead_statuses` = `["new","contacted","qualified","escalated"]`; excludes Customer; proposed non-open CC-confirmable
3. Form allowlisted + Auth-Results fail → HOLD `form_auth_failure` (never filtered)
4. Executable bootstrap `02` §§1–12 + `11-bootstrap-order.md`
5. `09` Section A Pre-build / Section B Pre-webhook
6. `claim_intake_batch` + `FOR UPDATE SKIP LOCKED`; queue terminal state machine

### Challenge non-blocking notes
1. Audit existing contacts/leads policies before ENABLE RLS
2. open_lead_statuses still confirmable
3. Auth-Results/Hostinger field mapping MUST_CAPTURE before Pre-webhook
4. held→pending workflow-enforced only
5. Tighten "otherwise identified form path" at implement
6. **(supplement)** Filter step must not run before form-auth HOLD for allowlisted known_form_senders From — or define form path = allowlist only
7. **(supplement)** Name kill-switch resume actor while reconcile schedule is still inactive (reconcile tick vs worker-on-claim vs ops SQL)


### Standing Pass 1 locks (summary)
- Intake-only; no AI/draft/send/`email_responses`/`email_send_queue`
- `auto_send_enabled=false`; no HCP writes; no customer sends
- Hostinger webhook OFF until Pre-webhook gate
- Every `email_automation` row `tenant_id='tvg'`
- Kill switch `intake_processing_enabled` without changing Hostinger config
- Internal notify only (Erron-approved destination)

---
## 10-change-log-vs-v4.md
# 10 — Change Log vs `pass1-v4/` (Pass 1 v5)

**Status:** DESIGN REVIEW ONLY  
**Supersedes for implementation intent:** `pass1-v4/` (keep as historical reference; **do not edit**)  
**Maps Command Center RETURN_WITH_CHANGES items 1–6.**  
**Preserve:** all v4 rules not listed below (see README standing rules + Pass 1 MUST INCLUDE).

---

## Command Center items 1–6 (explicit map)

| # | CC correction | Where implemented in v5 |
|---|---------------|-------------------------|
| **1** | **RLS policies for n8n access to contacts/leads.** Grants alone insufficient. Least privilege: prefer SELECT; any write must be explicit + justified for Pass 1 identity linking only. | `02` ENABLE RLS + `n8n_contacts_tvg_select` / `n8n_leads_tvg_select` (**SELECT only**, `tenant_id='tvg'`); `03`§4.2 matrix + verification; README standing rule 15. **No** CRM write grants or write policies (Pass 1 does not create CRM rows). |
| **2** | **Production-realistic open-lead status definition.** Do not treat full staging enum as “open.” Exclude closed/terminal. Inventory-backed where possible; mark Founder/CC-confirmable. | `04`§5 rewritten: evidence table (`leads.status` is free text; `Customer` terminal from proof fixtures + QB sync map); allowlist `["new","contacted","qualified","escalated"]`; explicit non-open list incl. `Customer` + proposed terminals; settings seed description in `02`; fixtures F17; README. |
| **3** | **Website-form authentication failure must HOLD rather than be filtered.** Allowlisted form sender/path + Auth-Results fail → **HOLD**, never silently `filtered`. | `04`§6 + ordered resolution step 1 (`form_auth_failure`); setting `hold_on_form_auth_failure=true` in `02`; `01` Mermaid + trust principle; `06` worker step 10 + digest exclusion; `08` F4c expect **held / form_auth_failure — NOT filtered**; `05` Auth-Results note. |
| **4** | **Correct executable bootstrap/build order** (extensions → schemas → roles → tables → FKs → RLS ENABLE → policies → grants → seeds) without forward-reference failures. | New [`11-bootstrap-order.md`](./11-bootstrap-order.md); `02` reordered into numbered sections 1–12 (role **before** GRANT; FKs after tables; RLS ENABLE → policies → REVOKE/GRANT → seeds); README index. |
| **5** | **Split pre-build and pre-webhook safety gates.** | `09` rewritten: **Section A Pre-build** (before DDL/role) / **Section B Pre-webhook** (notify set+tested, kill switch verified, intake ready, before Hostinger traffic). |
| **6** | **Atomic worker claim/concurrency + consistent queue terminal states.** | `02` `claim_intake_batch` + comments on `locked_at`/`locked_by`; `06`§4 claim SQL (`FOR UPDATE SKIP LOCKED`), full status machine + transitions, alignment with `email_events`; `01`§8 summary; fixtures F18; settings `worker_claim_batch_size`. |

---

## Scope deltas vs v4 (summary)

| Topic | v4 | v5 |
|-------|----|----|
| contacts/leads RLS | GRANT SELECT only | GRANT SELECT **+** SELECT policies for `n8n_email_automation` |
| Open lead statuses | Full staging enum treated as open | Production-realistic **allowlist**; excludes `Customer`/terminals; CC-confirmable |
| Form auth fail | Fall through ordinary rules (could filter) | **HOLD** `form_auth_failure` — never filtered |
| Bootstrap order | GRANT/REVOKE before role/tables (forward-ref risk) | Ordered executable sequence + `11-bootstrap-order.md` |
| Safety gate | Single combined checklist | **Section A Pre-build** / **Section B Pre-webhook** |
| Worker claim | “Claim pending” (non-specific) | Atomic `FOR UPDATE SKIP LOCKED` + terminal state machine |

---

## Preserved from v4 (unchanged standing rules)

- No `email_responses` / `email_send_queue`
- Fetch-free fast path; pointer-keyed `intake_queue`; identity on `email_events`
- Fallback hash v2 + BodyNormalization v1 (`07` unchanged algorithm)
- Reconcile INBOX gap-fill + stale HOLD
- Phone conflict = phone match different email → HOLD
- Case-insensitive email; PSL; empty `known_form_senders` + auth required to trust
- `email_filter_lists`; real FKs; REVOKE/GRANT; RLS on email_automation tables; `entity_id` text; `uid` bigint
- Kill switch + resume (`deferred_kill_switch` → `pending`); notify internal only; `tenant_id=tvg`
- Pass1 vs Pass2 phase boundary; no Hostinger until authorized
- Staging `glkrykpksbsqmmilmjhs`; production SoR read-only; preserve `network_os_assurance_delivery_claims`

---

## Pack structure

| File | v5 note |
|------|---------|
| `README.md` | DESIGN REVIEW ONLY; CC items reflected in standing rules / MUST INCLUDE |
| `01-architecture.md` | Form-auth HOLD; atomic claim; queue terminal summary |
| `02-email-automation-schema.sql` | Reordered bootstrap; CRM RLS; claim function; open-status + form-auth settings |
| `03-n8n-role.md` | contacts/leads RLS section |
| `04-identity-and-routing.md` | §§5–6 rewritten for CC 2–3 |
| `05-hostinger-endpoints.md` | Pre-webhook gating language; Auth-Results for HOLD |
| `06-n8n-intake-worker-reconcile.md` | §4 claim + state machine |
| `07-idempotency.md` | Algorithm preserved from v4 |
| `08-synthetic-fixture-plan.md` | F4c HOLD; F17 Customer exclusion; F18–F19 |
| `09-staging-safety-gate.md` | Section A / Section B split |
| `10-change-log-vs-v4.md` | This file |
| `11-bootstrap-order.md` | Executable apply order |

---

## Founder / Command Center–confirmable assumptions

1. **Open lead allowlist** = `new`, `contacted`, `qualified`, `escalated` (active pipeline). **`Customer` excluded** (inventory-backed terminal). Proposed non-open: `closed`, `won`, `lost`, `abandoned`, `cancelled`, `archived`, `disqualified`. Confirm `escalated` stays open; optional production distinct-status census.
2. **Form auth failure** uses `hold_reason=form_auth_failure` and queue/event `held` — confirm naming.
3. **CRM writes** remain out of Pass 1 (SELECT-only policies). Confirm no Pass 1 identity path needs INSERT/UPDATE on contacts/leads.
4. **BodyNormalization v1** / fallback hash v2 remain as in v4 `07` (unchanged).
5. **`contacts.phone` uniqueness** still taken as Founder fact for phone-conflict rule.
6. Reconcile lookback default **24 hours**; claim batch default **1**; stale/lease TTL default **10 minutes**.


---
## CHALLENGE_VERDICT.md
# Challenge Verdict — pass1-v5

**Time:** 2026-09-24 ~03:04 ET  
**Reviewer:** BHFOS Challenge Reviewer  
**Verdict:** CHALLENGE_PASS  

## Strongest point
Design-only intake pack with hard Pass1/Pass2 boundary (no email_responses/email_send_queue), SELECT-only contacts/leads RLS for n8n_email_automation (tenant_id=tvg), form-auth fail → HOLD form_auth_failure (never filtered), atomic claim_intake_batch + FOR UPDATE SKIP LOCKED with documented terminal states, kill-switch resume that does not auto-unHOLD, fetch-free fast path, and executable bootstrap 02§§1–12 + 11 + split 09 A/B gates. CC items 1–6 mapped in 10-change-log-vs-v4.md.

## Non-blocking notes
1. Before any apply: audit existing contacts/leads policies — ENABLE RLS must not lock out app roles.
2. open_lead_statuses allowlist still Founder/CC-confirmable (escalated; prod census optional).
3. Auth-Results / Hostinger field mapping remains MUST_CAPTURE before Pre-webhook.
4. held→pending is workflow-enforced only (no DB guard).
5. “Otherwise identified form path” beyond known_form_senders is slightly soft — tighten at implement.

## Block reasons
none

## Recommendation
proceed (design review only — implement still NOT authorized by this verdict)

## Next
Coordinator couriers to Command Center without Founder relay.


---
## 11-bootstrap-order.md
# 11 — Bootstrap / Apply Order (Pass 1 v5)

**Status:** DESIGN REVIEW ONLY — do not apply until **Section A Pre-build** PASS + Founder staging-migrate OK  
**Purpose:** Executable order that avoids forward-reference failures (role before GRANT; tables before FK/RLS/policy; policies before relying on grants under RLS).  
**Canonical SQL:** [`02-email-automation-schema.sql`](./02-email-automation-schema.sql) (sections numbered to match).

---

## Preconditions (not created by this pack)

1. Staging project `glkrykpksbsqmmilmjhs` reachable with a migration / owner role.  
2. CRM baseline present: `public.contacts`, `public.leads` (for real FKs).  
3. `public.network_os_assurance_delivery_claims` preserved (do not drop/alter).  
4. Hostinger webhook traffic **OFF**; n8n email schedules **inactive**.  
5. Section A of `09-staging-safety-gate.md` PASS.

---

## Ordered sequence

| Step | What | Why this order | Notes |
|------|------|----------------|-------|
| **1** | Extensions (`pgcrypto`) | Needed for `gen_random_uuid()` | `CREATE EXTENSION IF NOT EXISTS` |
| **2** | Schemas (`email_automation`, `integrations`) | Containers for types/tables | Comments OK |
| **3** | Role `n8n_email_automation` | **Must exist before any `GRANT … TO n8n_email_automation`** | `LOGIN NOINHERIT`; idempotent `DO $$ … EXCEPTION` |
| **4** | Enums / types in `email_automation` | Tables reference enum types | Incl. `intake_queue_status`, `email_event_status`, filter/notification enums |
| **5** | Tables | No cross-table FKs yet (or deferrable) | Create all `email_automation.*` + `integrations.external_references` |
| **6** | Foreign keys | Referenced tables must exist | CRM FKs to `contacts`/`leads`; internal FKs for errors/notification/queue→events |
| **7** | Indexes | After table columns exist | Unique pointer + identity uniques |
| **8** | Functions + triggers | Tables must exist | `set_updated_at`; **`claim_intake_batch`** |
| **9** | `ENABLE ROW LEVEL SECURITY` | Tables must exist | email_automation.* + integrations.external_references + **contacts/leads** |
| **10** | Policies | RLS enabled; role exists | n8n tenant policies; **contacts/leads SELECT-only**; service_role break-glass |
| **11** | REVOKE / GRANT | Role + tables + policies exist | Private schema REVOKEs; USAGE; table grants; `EXECUTE` on claim function |
| **12** | Seeds / settings | Tables + grants ready | `automation_settings` (incl. open-lead allowlist, `hold_on_form_auth_failure`); `email_filter_lists`; **no** `known_form_senders` rows |

---

## Anti-patterns (do not do)

| Bad order | Failure mode |
|-----------|--------------|
| `GRANT … TO n8n_email_automation` before step 3 | `role "n8n_email_automation" does not exist` |
| FK to `email_events` before that table exists | `relation does not exist` |
| FK to `public.contacts` before CRM baseline | `relation "public.contacts" does not exist` |
| Policies before `ENABLE ROW LEVEL SECURITY` | Policies unused / advisor noise; still enable before relying on RLS |
| Grants without policies (under RLS) | n8n sees **zero rows** on contacts/leads/email tables |
| Seeds before tables | insert target missing |
| Enabling Hostinger webhooks during bootstrap | Violates Pre-webhook gate |

---

## Post-apply smoke checks (staging only)

```sql
-- Role + schemas
SELECT 1 FROM pg_roles WHERE rolname = 'n8n_email_automation';

-- No Pass 2 tables
SELECT to_regclass('email_automation.email_responses');   -- NULL
SELECT to_regclass('email_automation.email_send_queue');  -- NULL

-- Settings
SELECT key, value_json FROM email_automation.automation_settings
WHERE tenant_id='tvg' AND key IN (
  'auto_send_enabled',
  'intake_processing_enabled',
  'open_lead_statuses',
  'hold_on_form_auth_failure'
);

-- Empty form seed
SELECT COUNT(*) FROM email_automation.known_form_senders;  -- 0

-- CRM RLS policies present
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('contacts','leads') AND policyname LIKE 'n8n_%';

-- Claim function executable
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='email_automation' AND proname='claim_intake_batch';
```

---

## Relationship to gates

| Gate | Bootstrap |
|------|-----------|
| Section A Pre-build PASS | Required **before** steps 1–12 |
| Steps 1–12 applied | Still **no** Hostinger traffic |
| Section B Pre-webhook PASS | Required **before** webhook enable / schedule activate |


---
## 09-staging-safety-gate.md
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
- [ ] Stage 2 send

…[truncated for ChatGPT; full on Coordinator box: 09-staging-safety-gate.md]


---
## 04-identity-and-routing.md (excerpt — open statuses + form auth HOLD)
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

Store `spf_pass` / `d

…[truncated for ChatGPT; full on Coordinator box: 04-identity-and-routing.md]


---
## README.md (excerpt)
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
| 33 | Complete RLS policies for every 

…[truncated for ChatGPT; full on Coordinator box: README.md]


---
## End of courier packet
Adjudicate pass1-v5 DESIGN REVIEW ONLY → ACCEPT | RETURN_WITH_CHANGES | REJECT.
If ACCEPT: say whether staging build/implement is authorized or still design-only.
Full SQL/schema (`02`) and remaining docs available on Coordinator box if you need a follow-up excerpt (do not request secrets).
