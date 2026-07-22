# ML-P1 Slice 4 — Planning Design (machines, auth, CO, UI, migration, tests)

> Companion to `ML-P1_SLICE4_DECISION_PACKET.md`.  
> **Founder-ratified 2026-07-22** (PD-S4-01…06). Policy sections below are binding.  
> Live aliases preferred where they already exist in DB/edge.

Base: `2a03d876126329a5c97b36fce4414b1c91e56f3c`  
Disposition: `SLICE4_READY_TO_AUTHORIZE_CODING` (coding not started)

---

## 0. Ratified product policy (binding)

| PD | Decision |
| --- | --- |
| PD-S4-01 | **B** Make-safe only: stop equipment, disconnect unsafe appliance, secure unsafe vent/component, document, advise not to operate. No repair/replacement/billable extra until CO approved. Draft emergency CO; non-billable until approved. |
| PD-S4-02 | **A** Tech never self-approves CO |
| PD-S4-03 | **C** Optional customer ack; office waiver; tech must document why ack missing |
| PD-S4-04 | **B** Price-book only for tech; free-form price needs office approval before customer sees/approves |
| PD-S4-05 | Founder wording below; Dispatched = derived |
| PD-S4-06 | **A** Customer required for every billable/material CO; office break-glass needs reason + proof of customer auth (verbal/email/text). Block complete while pending. Rejected never billable. Rejected CO does **not** block complete if unused and original scope done. |
| Invoice | **Disable/gate** invoice-on-complete in S4 |

---

## 1. Canonical job execution state machine (RATIFIED language)

### 1.1 Vocabulary reconciliation

**Founder product sequence:**  
Created → Scheduled → On the way → Arrived → In progress → Paused → No access / Reschedule required → Completion pending → Completed → Cancelled

| Founder label | Live / S4 storage value | Notes |
| --- | --- | --- |
| Created | `unscheduled` | Post–Slice 3 create (UI may say Created) |
| (office queue) | `pending_schedule` | Needs schedule — keep live |
| Scheduled | `scheduled` | Requires window and/or intent |
| Dispatched | *derived* | **Not** a tech action — `scheduled` + assigned tech + appointment confirmed |
| On the way | `en_route` | Keep live token |
| Arrived | `arrived` **NEW** | Add to contract |
| In progress | `in_progress` | Keep |
| Paused | `on_hold` | Keep live token; UI says Paused |
| No access | `no_access` **NEW** | Requires reason |
| Reschedule required | `reschedule_required` **NEW** | Requires reason |
| Completion pending | `completion_pending` **NEW** | Evidence / office validation |
| Completed | `completed` | Terminal for S4; **no invoice create** |
| Cancelled | `cancelled` | Terminal (reopen = office break-glass) |

**Out of S4 writable FSM (operational/invoice layer):** `ready_to_invoice`, `invoiced`, `open`, `closed`, `started`, `pending` — normalize/read-only aliases only; S5 owns invoice stage.

### 1.2 Allowed transitions (PROPOSED)

```
unscheduled → pending_schedule | scheduled | cancelled
pending_schedule → unscheduled | scheduled | cancelled
scheduled → en_route | in_progress* | on_hold | no_access | reschedule_required | cancelled
en_route → arrived | in_progress | scheduled† | on_hold | no_access | reschedule_required | cancelled
arrived → in_progress | on_hold | no_access | reschedule_required | cancelled
in_progress → on_hold | completion_pending | completed‡ | no_access | reschedule_required | cancelled§
on_hold → scheduled | en_route | arrived | in_progress | reschedule_required | cancelled
no_access → reschedule_required | scheduled | cancelled
reschedule_required → pending_schedule | scheduled | cancelled
completion_pending → completed | in_progress¶ | cancelled§
completed → (none in S4) ; reopen = office break-glass → in_progress or scheduled (PD)
cancelled → (none) ; reopen = office break-glass only
```

\* Skip `en_route` only if office/dispatcher authorizes “start on site” (same-location / already present) — capability-gated.  
† Return to scheduled = aborted travel; reason required.  
‡ Direct `in_progress → completed` only if evidence gate passes (may skip `completion_pending` for single-actor path).  
§ Cancel after work begins: reason + role (office/admin); tech may request cancel → office confirms.  
¶ Rejected completion (missing evidence) returns to `in_progress` with blockers.

Unknown transition → **DENY**. Idempotent self-transition → **OK** (same state, same actor constraints).

### 1.3 Side effects by transition (S4)

| Transition | Required | Forbidden |
| --- | --- | --- |
| → `en_route` | assigned tech; travel_start event | invoice |
| → `arrived` | prior en_route or authorized skip; arrival event | invoice |
| → `in_progress` | on-site start event | out-of-scope work without approved CO (except emergency PD) |
| → `completion_pending` / `completed` | evidence contract pass; scope accounting | **invoice create**; quote mutate |
| → `no_access` / `reschedule_required` / `cancelled` | reason code + note | silent delete |

---

## 2. Authorization matrix (PROPOSED pending PD)

Roles (extend S2 normalize): `admin`, `office`/`csr`, `dispatcher`, `technician`, `viewer`, `partner`, `customer` (token), `unauthenticated`.

| Capability | Admin | Office/CSR | Dispatcher | Technician (assigned) | Technician (other) | Viewer | Partner | Customer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Assign / reassign tech | Y | Y | Y | N | N | N | N | N |
| Set/reschedule appointment | Y | Y | Y | N* | N | N | N | N |
| Cancel job (pre-work) | Y | Y | Y | Request only | N | N | N | N |
| Cancel after work began | Y + reason | Y + reason | N default | Request only | N | N | N | N |
| En route / arrive / start / pause / resume | Y | Y† | Y† | Y | N | N | N | N |
| No access / reschedule required | Y | Y | Y | Y | N | N | N | N |
| Complete / submit completion | Y | Y | N default | Y | N | N | N | N |
| Reopen completed | Break-glass + reason | Break-glass + reason | N | N | N | N | N | N |
| Propose change order | Y | Y | N | Y | N | N | Per policy | N |
| Approve change order (customer) | — | — | — | N | N | N | N | Token path (required for billable/material) |
| Approve change order (office) | Y* | Y* | N | **N** | N | N | N | N |
| Break-glass CO approve | Y + reason + proof | Y + reason + proof | N | N | N | N | N | N |
| Set CO prices | Office free-form OK | Office free-form OK | N | Price book only | N | N | N | N |
| Edit time/mileage correction | Y | Y + reason | Y + reason | Own events + reason (limited window) | N | N | N | N |
| View job / evidence | Y | Y | Y | Assigned | N | Y read | Scoped | Own job token |

\* Tech may propose reschedule → office/dispatcher confirms.  
† Office/dispatcher field actions are break-glass when not assigned tech.  
\* Office CO approve follows PD-S4-06 (customer required; break-glass needs reason + proof of customer authorization).  
‡ *(removed — see PD ratification §0)*

UI hiding ≠ authorization. Server DENY-by-default.

---

## 3. Assignment and scheduling

| Rule | Design |
| --- | --- |
| Assigned technician | `jobs.technician_id` → `technicians.id` (KI-09) |
| Appointment window | `appointments` linked to job; `scheduled_start`/`scheduled_end` synced |
| Reassignment | Server action; audit old/new; cancels prior active assignment uniqueness |
| Unique active assignment | Partial unique: one active tech assignment per job; tech may have multiple jobs but conflict scoring warned |
| Reschedule | New window + audit; status may → `reschedule_required` then `scheduled` |
| Cancellation | Status `cancelled` + reason code; retain row |
| Conflict handling | Soft warn in office UI; hard DENY only if Founder later requires |
| Audit | actor, from/to, reason, timestamps, appointment ids |

No duplicate **active** jobs per approved quote version (S3 UNIQUE remains).

---

## 4. Field actions (canonical RPCs / writer ops)

| Action | From → To | Evidence |
| --- | --- | --- |
| on_my_way | scheduled → en_route | travel_start_at |
| arrive | en_route → arrived | arrived_at |
| start | arrived\|en_route\* → in_progress | on_site_start_at |
| pause | in_progress → on_hold | pause event + optional reason |
| resume | on_hold → in_progress | resume event |
| no_access | * → no_access | reason code required |
| request_reschedule | * → reschedule_required | reason |
| complete_submit | in_progress → completion_pending or completed | evidence gate |
| reopen | completed → in_progress\|scheduled | office break-glass + reason |

All actions: idempotency key (job_id + action + client_mutation_id); duplicate tap returns same result.

---

## 5. Time and mileage model

### Tables (PROPOSED)

`job_time_events` (append-only):

| Column | Purpose |
| --- | --- |
| id, job_id, tenant_id | keys |
| event_type | `travel_start`, `travel_end`, `onsite_start`, `onsite_end`, `pause`, `resume`, `correction` |
| started_at, ended_at | interval |
| miles | nullable numeric |
| source | `technician`, `office`, `system` |
| actor_id | uuid |
| reason_code / note | required on correction |
| client_mutation_id | duplicate prevention UNIQUE(job_id, client_mutation_id) |
| superseded_by | correction lineage |

### Rules

- Open interval: at most one open travel and one open onsite per job.
- Corrections never delete; create correcting event + link.
- Who may edit: matrix §2; tech limited to own recent events (e.g. 24h) unless office.
- Duplicate prevention via UNIQUE mutation id + server open-interval checks.
- Mileage optional per event; no silent overwrite.

---

## 6. Evidence and completion contract

### Required for completion (RATIFIED)

| Artifact | Required? | Storage |
| --- | --- | --- |
| Before photos | Y (min N≥1) unless office waiver + reason | storage bucket + `execution_photos` refs |
| After photos | Y (min N≥1) unless waiver | same |
| Work performed / findings | Y | `execution_findings` / structured |
| Technician notes | Y (non-empty) | `technician_notes` |
| Customer-facing summary | Y | `customer_summary` |
| Checklist | Y all required items true | `execution_checklist` |
| Parts/materials | Y if used; else explicit “none” | new `job_materials` or checklist section |
| Signature / acknowledgement | **Optional (PD-S4-03)**; if missing, tech documents why; office may waive with reason | signature / ack fields |
| Approved CO scope | All approved COs accounted | CO ledger |
| Rejected/unapproved CO work | Must be absent from billable completion set; rejected unused CO does **not** block complete | gate |

**Blockers** list returned by `ml_p1_s4_completion_readiness(job_id)`; complete DENY if any blocker.

Photo upload failure → DENY complete; allow retry; no fake blob URLs.

---

## 7. Change-order domain model

### 7.1 Object

`change_orders` (+ `change_order_items`, `change_order_events`):

| Field | Rule |
| --- | --- |
| id, tenant_id, job_id | required; job must exist |
| source_quote_id / source_quote_version | pinned from job; **immutable** |
| change_order_number / version | tenant sequence + version int |
| supersedes_change_order_id | lineage |
| status | see §7.2 |
| reason | required |
| financial_delta_cents | exact signed delta |
| currency | tenant default |
| line items | add / remove / qty change / price change / credit |
| evidence_refs | photos where required |
| proposed_by, proposed_at | |
| approved_by, approved_at, approval_method | customer_token \| office \| break_glass |
| break_glass_reason | required if break_glass |
| client_mutation_id | idempotency |

**Never** mutate original approved quote rows.  
**Never** mutate invoice totals in S4 (no invoices created).

### 7.2 CO state machine

```
draft → proposed | cancelled
proposed → pending_approval | cancelled | draft
pending_approval → approved | rejected | cancelled
approved → superseded (via new approved version only)
rejected → (terminal) | draft (revise = new version, not reopen same)
cancelled → terminal
superseded → terminal
```

Immutable after `approved` / `rejected` / `cancelled` / `superseded`.

### 7.3 CO approval matrix (RATIFIED)

| Actor | Propose | Approve | Reject | Break-glass approve |
| --- | --- | --- | --- | --- |
| Technician (assigned) | Y | **N** (PD-S4-02) | N | N |
| Office/CSR | Y | Y only with customer path or break-glass | Y | Break-glass: reason + documented proof of customer authorization (verbal/email/text) (PD-S4-06) |
| Admin | Y | Y (same customer/break-glass rules) | Y | Y + reason + proof |
| Customer (token) | N | Y (required for every billable/material CO) | Y | N |
| Dispatcher / Viewer / Partner | N / read | N | N | N |

**Pricing (PD-S4-04):** Tech selects price-book services/qty/options only. Free-form price requires office approval **before** customer sees or approves.

Repeated approve → idempotent. Concurrent approve → one winner.

### 7.4 Billing readiness handoff (S5)

- Approved CO deltas are the **only** additive billable scope beyond original quote version.
- Rejected/cancelled/draft/proposed/pending → **not billable**.
- S5 invoice generation must read CO ledger; S4 only marks completion readiness including CO accounting.
- **S4 does not create invoices** (invoice-on-complete disabled/gated).

### 7.5 Emergency / safety exception (RATIFIED PD-S4-01 = B)

**Make-safe allowlist only:**

- stop equipment  
- disconnect unsafe appliance  
- secure unsafe vent/component  
- document condition (+ photos as required)  
- advise customer not to operate  

**Not allowed before CO approval:** repair, replacement, billable extra work.

Server creates/attaches an emergency make-safe CO draft; remains **non-billable until approved**.

---

## 8. Job completion rules (RATIFIED)

Completion allowed iff:

1. Job in `in_progress` or `completion_pending`.
2. Original approved quote scope completed or explicitly waived items with office reason.
3. Every **approved** CO accounted (done / N/A with reason).
4. **No CO in `pending_approval`** (block complete while pending — PD-S4-06).
5. Rejected COs: **not billable**; do **not** block complete if rejected work was **not performed**.
6. Evidence contract pass; optional customer ack per PD-S4-03 (if missing: tech reason; office may waive).
7. Technician notes present.
8. No unresolved blockers.
9. Actor authorized.
10. `completed_at` set server-side once; audit `JobCompleted`.
11. Idempotent: second complete returns same `completed_at` / job id.

**S4 does not create invoices.** Disable/gate invoice branch in `work-order-update` for S4 path.

---

## 9. Failure and recovery

| Failure | Recovery |
| --- | --- |
| Offline / interrupted tech action | Client queues mutation id; server idempotent apply |
| Duplicate taps | UNIQUE client_mutation_id |
| Concurrent office/tech | Row version / `updated_at` check; loser refreshes |
| Stale client | DENY with current state payload |
| Missing evidence | DENY complete; blockers list |
| Failed photo upload | Retry; no complete |
| Rejected CO after proposed work | Work not billable; office disposition; may need credit CO or redo |
| Partial completion | Remain `in_progress`; partial flags; no silent drop |
| No access | `no_access` + reason; schedule path |
| Reschedule | `reschedule_required` → new window |
| Cancel after work began | Office + reason; time events retained |
| Reopen after complete | Break-glass only |
| Audit/event write failure | Fail closed transaction (no status without audit) |

---

## 10. Minimum field UI (mobile-first)

Single job card / detail (not desktop compressed):

- Customer, address, appointment window  
- Current state + **next required action**  
- Approved scope summary + linked quote (read-only)  
- CO status strip (none / draft / pending / approved count)  
- Evidence checklist with upload  
- Primary controls: On my way → Arrive → Start → Pause/Resume → Complete  
- Exception: No access / Reschedule  
- Propose change order  
- Clear blockers panel  
- No invoice/payment UI  

Route plan: enhance `/:tenantId/tech/jobs/:id` (or replace TechJobDetail). Wire orphan wizard patterns into this page with real uploads.

---

## 11. Minimum office UI

On `/crm/jobs` + job detail drawer/page:

- Assign tech, schedule, reassign  
- Live status  
- Exceptions queue (no_access, reschedule_required, on_hold)  
- Pending change orders + approve/reject / send to customer  
- Completion readiness  
- Linked evidence viewer  
- Audit history  
- Break-glass reopen / CO approve with reason  

Dispatch/calendar remain schedule surfaces; must call same server writer.

---

## 12. Migration ordering and live-posture checks

### Order

1. **Additive** status legalization: `arrived`, `no_access`, `reschedule_required`, `completion_pending` (+ UI aliases).  
2. Tables: `job_time_events`, `change_orders`, `change_order_items`, `change_order_events` (+ storage policies for job evidence).  
3. RLS: revoke broad authenticated UPDATE on status/money columns; grant execute on S4 RPCs.  
4. RPCs: transition, evidence upsert, complete, CO propose/approve/reject, readiness.  
5. Neutralize invoice-on-complete in edge or replace edge with RPC-only path.  
6. Backfill: none destructive; orphan statuses normalize read-only.  
7. I2 live posture: constraints, grants, function presence, deny probes.

### Live checks (pre-apply)

- Count jobs by status  
- Confirm S3 ensure_job still sole create-from-quote  
- Confirm no `change_orders` table yet  
- Confirm Hostinger tip identity for UI deploy later  

### Rollback

- Forward-fix only for schema; feature flag `enableMlP1S4Execution` off returns UI to read-only field  
- Retain prior edge archive for Hostinger redeploy  

---

## 13. Independent adversarial test sentinels

| ID | Sentinel |
| --- | --- |
| T-S4-01 | Unauthorized transition DENY |
| T-S4-02 | Duplicate start idempotent |
| T-S4-03 | Duplicate complete idempotent |
| T-S4-04 | Concurrent state change one winner |
| T-S4-05 | Stale technician client DENY |
| T-S4-06 | Missing evidence DENY complete |
| T-S4-07 | Change-order approve replay idempotent |
| T-S4-08 | Technician self-approve DENY (unless PD allows) |
| T-S4-09 | Unapproved work not billable / not in completion set |
| T-S4-10 | Approved CO omitted → readiness FAIL |
| T-S4-11 | Original quote mutation DENY |
| T-S4-12 | Direct invoice mutation from S4 path DENY / no create |
| T-S4-13 | Alternate job status writer DENY |
| T-S4-14 | Reopen without authority DENY |
| T-S4-15 | Partial transaction: no status without audit event |

---

## 14. Review plan

| Review | Focus |
| --- | --- |
| Product | States, CO, emergency PD, signature, pricing |
| UX/Field | Mobile job card, next action, blockers |
| Data | Migrations, UNIQUE, lineage, RLS |
| Security | Role matrix, assignment checks, break-glass |
| Architecture | Single writer, two-layer status, S5 boundary |
| Financial Control | CO delta, no quote/invoice mutate, billable set |
| Adversarial | Sentinels T-S4-01…15 |

Coding merge requires all reviews **APPROVE/PASS** at frozen head + Founder exact-SHA auth (same pattern as S2/S3).

---

## 15. Slice 4 boundary (binding)

**Includes:** field execution FSM, assignment/schedule mutations via canonical writer, time/mileage events, evidence gates, completion, change-order propose/approve/reject/supersede, office + tech minimum UI.

**Excludes:** invoice creation/issue · Stripe/payment · autonomous follow-up/OMW customer comms product (S6) · visual workflow builder · shared multi-tenancy · Slice 5+ scope · TIS · G2.3 reopen · flipping `auto_create_job_on_quote_acceptance`.
