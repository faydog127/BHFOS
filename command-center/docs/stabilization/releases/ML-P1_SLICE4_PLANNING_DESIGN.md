# ML-P1 Slice 4 — Planning Design (machines, auth, CO, UI, migration, tests)

> Companion to `ML-P1_SLICE4_DECISION_PACKET.md`.  
> Names marked **PROPOSED** pending Founder ratification of open product decisions.  
> Live aliases preferred where they already exist in DB/edge.

Base: `2a03d876126329a5c97b36fce4414b1c91e56f3c`

---

## 1. Canonical job execution state machine (PROPOSED)

### 1.1 Vocabulary reconciliation

| Founder candidate | Live / S4 proposed storage value | UI label (Work Order) | Notes |
| --- | --- | --- | --- |
| created | `unscheduled` | Unscheduled | Post–Slice 3 create |
| (office queue) | `pending_schedule` | Needs schedule | Keep live |
| scheduled | `scheduled` | Scheduled | Requires window and/or intent |
| dispatched | *derived* or alias | Dispatched | **PROPOSED:** not a separate DB status — means `scheduled` + assigned tech + appointment window set |
| on_the_way | `en_route` | On the way | Keep live token |
| arrived | `arrived` **NEW** | Arrived | Add to contract |
| in_progress | `in_progress` | In progress | Keep |
| paused | `on_hold` | Paused | Keep live token; UI says Paused |
| no_access | `no_access` **NEW** | No access | Add; requires reason |
| reschedule_required | `reschedule_required` **NEW** | Reschedule required | Add; requires reason |
| cancelled | `cancelled` | Cancelled | Terminal (with reopen break-glass separate) |
| completion_pending | `completion_pending` **NEW** | Completion pending | Tech submitted; office/system validating evidence |
| completed | `completed` | Completed | Terminal for S4; **no invoice create** |

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
| Approve change order (customer) | — | — | — | N | N | N | N | Token path |
| Approve change order (office) | Y | Y‡ | N | **PD-S4-02** | N | N | N | N |
| Break-glass CO approve | Y + reason | Admin-equivalent + reason | N | N | N | N | N | N |
| Set CO prices | **PD-S4-04** | **PD-S4-04** | N | Propose only default | N | N | N | N |
| Edit time/mileage correction | Y | Y + reason | Y + reason | Own events + reason (limited window) | N | N | N | N |
| View job / evidence | Y | Y | Y | Assigned | N | Y read | Scoped | Own job token |

\* Tech may propose reschedule → office/dispatcher confirms.  
† Office/dispatcher field actions are break-glass when not assigned tech.  
‡ Office approve of CO may still require customer path for material deltas — **PD**.

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

### Required for completion (PROPOSED defaults — signature is **PD-S4-03**)

| Artifact | Required? | Storage |
| --- | --- | --- |
| Before photos | Y (min N≥1) unless office waiver + reason | storage bucket + `execution_photos` refs |
| After photos | Y (min N≥1) unless waiver | same |
| Work performed / findings | Y | `execution_findings` / structured |
| Technician notes | Y (non-empty) | `technician_notes` |
| Customer-facing summary | Y | `customer_summary` |
| Checklist | Y all required items true | `execution_checklist` |
| Parts/materials | Y if used; else explicit “none” | new `job_materials` or checklist section |
| Signature / acknowledgement | **PD-S4-03** | deferred until decided |
| Approved CO scope | All approved COs accounted | CO ledger |
| Rejected/unapproved CO work | Must be absent from billable completion set | gate |

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

### 7.3 CO approval matrix

| Actor | Propose | Approve | Reject | Break-glass approve |
| --- | --- | --- | --- | --- |
| Technician (assigned) | Y | **PD-S4-02** default **N** | N | N |
| Office/CSR | Y | Y (policy) | Y | If admin-equivalent + reason |
| Admin | Y | Y | Y | Y + reason |
| Customer (token) | N | Y (public CO approve) | Y | N |
| Dispatcher / Viewer / Partner | N / read | N | N | N |

Repeated approve → idempotent return same approval. Concurrent approve → one winner; loser gets already_approved.

### 7.4 Billing readiness handoff (S5)

- Approved CO deltas are the **only** additive billable scope beyond original quote version.
- Rejected/cancelled/draft/proposed/pending → **not billable**.
- S5 invoice generation must read CO ledger; S4 only marks completion readiness including CO accounting.

### 7.5 Emergency / safety exception

**Not invented.** See Decision Packet **PD-S4-01**. Until decided: server DENY any scope outside approved quote + approved COs.

---

## 8. Job completion rules

Completion allowed iff:

1. Job in `in_progress` or `completion_pending`.
2. Original approved quote scope completed or explicitly waived items with office reason.
3. Every **approved** CO accounted (done / N/A with reason).
4. No pending/proposed CO blocking (policy: block complete while `pending_approval` — **recommended Y**).
5. Evidence contract pass.
6. Technician notes present.
7. No unresolved blockers.
8. Actor authorized.
9. `completed_at` set server-side once; audit `JobCompleted`.
10. Idempotent: second complete returns same `completed_at` / job id.

**S4 does not create invoices.** Remove/disable invoice branch in `work-order-update` for S4 writer.

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
