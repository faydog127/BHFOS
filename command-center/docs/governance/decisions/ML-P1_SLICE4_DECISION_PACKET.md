# Decision Packet — ML-P1 Slice 4 Planning

> Planning docs amended with **Founder-ratified** PD-S4-01…06 (2026-07-22).  
> This packet sets readiness to **authorize** coding. It does **not** itself authorize
> migrations, Edge deploy, Hostinger deploy, or Builder coding until the Founder
> issues the coding authorization line below.
>
> Planning base (authoritative main): `2a03d876126329a5c97b36fce4414b1c91e56f3c`  
> Production UI baseline: Hostinger `d87f2e6e923652b05ea3518a7e9a4358b4cce178`  
> Slices 1–3 coherence: **PASS** · Slice 3 production validation: **PASS**  
> Residuals tracked non-blocking: R-COH-08, R-COH-12, R-COH-14  
> Canonical Quotes route: `/tvg/crm/quotes`

---

## Disposition

# **SLICE4_READY_TO_AUTHORIZE_CODING**

All PD-S4-01…06 product decisions are **closed**. Design may be implemented only after
Founder issues the **coding authorization** (template at end). No coding has started.

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S4` |
| Slice | Canonical field job execution, completion, and first-class change orders |
| Operator | The Vent Guys (V1) |
| Planning branch | `plan/ml-p1-s4-field-execution` · worktree `F:\Dev\BHFOS-ml-p1-s4-plan` |
| Coding branch (after auth) | `ml/p1-s4-job-execution` · worktree `F:\Dev\BHFOS-ml-p1-s4` |
| Companions | `ML-P1_SLICE4_ARCHITECTURE_FINDINGS.md`, `ML-P1_SLICE4_PLANNING_DESIGN.md`, `ML-P1_SLICE4_FOUNDER_DECISION_PACKET.md` |
| PD ratification | 2026-07-22 Founder reply (recorded below) |

---

## Founder-ratified product decisions (binding)

### PD-S4-01 — Emergency / make-safe — **B**

Allow only a narrow **make-safe** exception. Technician may:

- stop equipment  
- disconnect an unsafe appliance  
- secure an unsafe vent/component  
- document the condition  
- advise the customer not to operate it  

**Forbidden until change order approved:** repair, replacement, or any billable extra work.

Make-safe actions require documentation (and photos where applicable) and produce an
emergency / make-safe change-order draft that remains **non-billable until approved**.

### PD-S4-02 — Technician self-approve CO — **A**

**Never.** Technicians may document and propose change orders only. They may not approve
their own change order.

### PD-S4-03 — Signature / acknowledgement at complete — **C**

Optional customer acknowledgement with **office waiver**. Do not block every completion
because the customer is unavailable. Technician must **document why acknowledgement was
not obtained** when missing. Office may waive with reason.

### PD-S4-04 — CO pricing authority — **B**

**Approved price-book items only.** Technicians may select approved services, quantities,
and options from the price book. **Free-form pricing requires office approval before the
customer sees or approves** the change order.

### PD-S4-05 — Status language — **Accept with Founder wording**

Product sequence:

> Created → Scheduled → On the way → Arrived → In progress → Paused → No access /
> Reschedule required → Completion pending → Completed → Cancelled

**Dispatched** = derived office condition (scheduled + assigned technician + appointment
confirmed) — **not** a separate technician action.

Storage aliases (implementation): Created ≈ `unscheduled` (post–S3); On the way =
`en_route`; Paused = `on_hold`; plus `arrived`, `no_access`, `reschedule_required`,
`completion_pending` as designed.

### PD-S4-06 — CO customer vs office — **A** (+ completion rules)

- **Customer approval required** for every **billable** change order or material scope change.  
- **Office break-glass** allowed only with **required reason** and **documented proof of
  customer authorization** (recorded verbal, email, or text).  
- **Block complete while any CO is pending approval: Yes.**  
- **Rejected never billable: Yes.**  
- A **rejected** change order **must not block completion** if the original approved scope
  is completed and the rejected extra work was **not performed**.

### Invoice on job complete (Slice 4 boundary) — **Disable / gate: Yes**

Slice 4 must **not** create invoices on job complete. Neutralize / gate existing
invoice-on-complete behavior. Invoice creation remains Slice 5.

---

## Exact scope (when coding authorized)

1. Server-side job execution state machine + role/assignment authz.  
2. Field actions: on my way, arrive, start, pause, resume, no access, reschedule required, complete; make-safe exception per PD-S4-01.  
3. Time/mileage event model with correction audit.  
4. Evidence/completion contract (photos, findings, notes, checklist, materials; optional ack per PD-S4-03).  
5. First-class **change_orders** writer per PD-S4-02/04/06; original approved quote immutable.  
6. Minimum mobile field UI + minimum office UI.  
7. **Disable/gate invoice-on-complete.**  
8. Adversarial sentinels T-S4-01…15.

## Explicit non-scope

Invoice creation/issue · Stripe/payment · autonomous follow-up · OMW customer SMS/email product (S6) · visual workflow builder · shared multi-tenancy · TIS · G2.3 reopen · Slice 5+ · `auto_create_job_on_quote_acceptance=true`.

---

## Coding readiness decision

| Gate | Result |
| --- | --- |
| Architecture inventory complete | YES |
| Design drafted | YES |
| Product decisions closed | **YES** — PD-S4-01…06 + invoice gate ratified |
| Scope expansion beyond Founder S4 ask | NO |
| Rollback/review gates defined | YES |
| Exact branch/base frozen for coding | PENDING Founder coding authorization + coding worktree create |

**Disposition:** `SLICE4_READY_TO_AUTHORIZE_CODING`  
**Coding started:** NO — awaiting Founder coding authorization.

---

## Coding authorization template (Founder — issue to start Builder)

> Authorize ML-P1 Slice 4 coding on `ml/p1-s4-job-execution` / `F:\Dev\BHFOS-ml-p1-s4`  
> at base `<merge planning docs to main, then that SHA>` (or pin exact SHA), implementing  
> field execution + change orders per `ML-P1_SLICE4_DECISION_PACKET.md` and  
> `ML-P1_SLICE4_PLANNING_DESIGN.md` with ratified PD-S4-01=B (make-safe allowlist),  
> PD-S4-02=A, PD-S4-03=C, PD-S4-04=B, PD-S4-05=Founder wording, PD-S4-06=A  
> (block complete while pending; rejected never billable; rejected does not block if  
> unused). Disable/gate invoice-on-complete. Stop before invoice/Stripe/follow-up.  
> Migrations only as named. Merge requires exact head-SHA auth after reviews PASS.
