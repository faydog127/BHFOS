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
