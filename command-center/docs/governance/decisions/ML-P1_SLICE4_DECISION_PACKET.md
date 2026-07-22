# Decision Packet — ML-P1 Slice 4

> Coding authorized. Product decisions PD-S4-01…06 are **ratified** below.
>
> Coding base (authoritative main at branch cut): `24cec0e4d168a17384a5c16616c41e637a713fdc`  
> Prior planning base: `2a03d876126329a5c97b36fce4414b1c91e56f3c`  
> Production UI baseline: Hostinger `d87f2e6e923652b05ea3518a7e9a4358b4cce178`  
> Slices 1–3 coherence: **PASS** · Slice 3 production validation: **PASS**  
> Residuals tracked non-blocking: R-COH-08, R-COH-12, R-COH-14  
> Canonical Quotes route: `/tvg/crm/quotes`

---

## Disposition

# **SLICE4_CODING_AUTHORIZED**

Founder authorized Slice 4 coding on `ml/p1-s4-job-execution` / `F:\Dev\BHFOS-ml-p1-s4` with ratified PD-S4-01…06.  
Delegated authority continues automatically through coding, local tests, migration drafting, source guards, bounded remediation, evidence, review dispatch/reconciliation, PR preparation, and exact-head freeze.

**Stop before:** merge (unless exact-head merge authority is separately granted and gates pass); production migration apply; production deploy; Slice 5; Stripe; invoice implementation; autonomous follow-up; TIS; G2.3; multi-tenancy.

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S4` |
| Slice | Canonical field job execution, completion, and first-class change orders |
| Operator | The Vent Guys (V1) |
| Coding branch | `ml/p1-s4-job-execution` |
| Worktree | `F:\Dev\BHFOS-ml-p1-s4` |
| Companions | `ML-P1_SLICE4_ARCHITECTURE_FINDINGS.md`, `ML-P1_SLICE4_PLANNING_DESIGN.md` |

---

## Exact scope

1. Server-side job execution state machine + role/assignment authz.  
2. Field actions: on my way, arrive, start, pause, resume, no access, reschedule required, completion pending, complete, cancel.  
3. Time/mileage event model with correction audit.  
4. Evidence/completion contract (photos, findings, notes, checklist, materials).  
5. First-class **change_orders** writer (propose/approve/reject/supersede) tied to one job; original approved quote immutable.  
6. Minimum mobile field UI + minimum office UI.  
7. Neutralize **invoice-on-complete** bleed from `work-order-update`.  
8. Adversarial sentinels T-S4-01…15 (+ extended coverage from Founder instruction).

## Explicit non-scope

Invoice creation/issue · Stripe/payment · autonomous follow-up · OMW customer SMS/email product (S6) · visual workflow builder · shared multi-tenancy · TIS · G2.3 reopen · Slice 5+ · `auto_create_job_on_quote_acceptance=true`.

---

## Ratified product decisions (binding)

### PD-S4-01 — Emergency / safety work before approval → **B (make-safe only)**

Technician may: stop unsafe equipment; disconnect an unsafe appliance; secure an unsafe vent/component; document the condition; advise the customer not to operate it.

Technician may not: repair; replace; perform billable extra work; expand scope — until a change order is approved.

Make-safe work is recorded, non-billable until an approved change order covers billable follow-on work.

### PD-S4-02 — Technician self-approval → **A (never)**

Technicians may propose change orders. Technicians may not approve their own change orders.

### PD-S4-03 — Customer acknowledgement at completion → **C (optional + office waiver)**

Do not block every completion because the customer is unavailable.  
If acknowledgement is not obtained, technician must document why. Office may waive with reason.

### PD-S4-04 — Change-order pricing authority → **B (approved price-book items only)**

Technician may select approved service/item, quantity, and approved option.  
Free-form pricing requires office approval before the customer sees or approves the change order.

### PD-S4-05 — Canonical status language → **Accepted**

UI labels:

Created → Scheduled → On the way → Arrived → In progress → Paused → No access → Reschedule required → Completion pending → Completed → Cancelled

Storage tokens (live aliases retained):

| UI | Storage |
| --- | --- |
| Created / Unscheduled | `unscheduled` (+ `pending_schedule` office queue) |
| Scheduled | `scheduled` |
| On the way | `en_route` |
| Arrived | `arrived` |
| In progress | `in_progress` |
| Paused | `on_hold` |
| No access | `no_access` |
| Reschedule required | `reschedule_required` |
| Completion pending | `completion_pending` |
| Completed | `completed` |
| Cancelled | `cancelled` |

**Dispatched** is derived: job scheduled + technician assigned + appointment confirmed — not a separate technician action.

**Completion pending** means technician believes work is finished, but final completion is blocked by missing evidence, missing acknowledgement/waiver, unresolved change order, required office review, or other defined blocker.

### PD-S4-06 — Change-order approval → **A**

Customer approval required for every billable change order or material scope change.  
Office break-glass allowed only with required reason + documented proof of customer authorization (verbal/email/text/equivalent) + audit.

Completion while a change order is `pending_approval`: **blocked**.  
Rejected change orders: never billable; do not block completion when rejected extra work was not performed and original approved scope is complete.  
Invoice on job completion: **disabled/gated** in Slice 4 (Slice 5 owns invoicing).

---

## Design freeze (post-PD)

| Artifact | Status |
| --- | --- |
| Job state machine + live alias map | **Ratified** |
| Authorization matrix | **Ratified** (tech never self-approves CO) |
| Time/mileage model | **Ratified** |
| Evidence/completion contract | **Ratified** (ack optional + waiver) |
| Change-order model + FSM | **Ratified** |
| Pricing | **Ratified** (price-book; free-form office-gated) |
| Emergency / make-safe | **Ratified** Policy B |
| Failure/recovery | **Ratified** |
| Field + office UI plans | **Ratified** |
| Migration order + I2 checks | **Ratified** |
| Test sentinels | **Ratified** |
| Review plan | **Ratified** |

---

## Coding authorization (active)

> Authorize ML-P1 Slice 4 coding on `ml/p1-s4-job-execution` / `F:\Dev\BHFOS-ml-p1-s4`  
> at base `24cec0e4d168a17384a5c16616c41e637a713fdc`, implementing field execution + change orders per  
> this packet and `ML-P1_SLICE4_PLANNING_DESIGN.md` with PD answers  
> PD-S4-01=B, PD-S4-02=A, PD-S4-03=C, PD-S4-04=B, PD-S4-05=accept, PD-S4-06=A.  
> Stop before invoice/Stripe/follow-up. Neutralize invoice-on-complete.  
> Migrations only as named. Merge requires exact head-SHA auth after reviews PASS.
