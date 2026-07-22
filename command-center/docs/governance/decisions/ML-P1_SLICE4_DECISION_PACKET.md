# Decision Packet — ML-P1 Slice 4 Planning

> **Docs / planning only.** This packet does **not** authorize coding, migrations, Edge deploy, or Hostinger deploy.
>
> Planning base (authoritative main): `2a03d876126329a5c97b36fce4414b1c91e56f3c`  
> Production UI baseline: Hostinger `d87f2e6e923652b05ea3518a7e9a4358b4cce178`  
> Slices 1–3 coherence: **PASS** · Slice 3 production validation: **PASS**  
> Residuals tracked non-blocking: R-COH-08, R-COH-12, R-COH-14  
> Canonical Quotes route: `/tvg/crm/quotes`

---

## Disposition

# **SLICE4_PLANNING_REQUIRES_PRODUCT_DECISION**

Architecture findings and design are frozen enough to implement **after** the Founder answers the open product decisions below.  
Standing delegated-authority **does not** continue into coding while any **PD-S4-*** item is unresolved.

---

## Release

| Field | Value |
| --- | --- |
| Release ID | `ML-P1-S4` |
| Slice | Canonical field job execution, completion, and first-class change orders |
| Operator | The Vent Guys (V1) |
| Planning branch | `ml/p1-s4-planning` |
| Coding branch (later) | `ml/p1-s4-job-execution` · worktree `F:\Dev\BHFOS-ml-p1-s4` |
| Companions | `ML-P1_SLICE4_ARCHITECTURE_FINDINGS.md`, `ML-P1_SLICE4_PLANNING_DESIGN.md` |

---

## Exact scope (when coding later authorized)

1. Server-side job execution state machine + role/assignment authz.  
2. Field actions: on my way, arrive, start, pause, resume, no access, reschedule required, complete.  
3. Time/mileage event model with correction audit.  
4. Evidence/completion contract (photos, findings, notes, checklist, materials).  
5. First-class **change_orders** writer (propose/approve/reject/supersede) tied to one job; original approved quote immutable.  
6. Minimum mobile field UI + minimum office UI.  
7. Neutralize **invoice-on-complete** bleed from `work-order-update`.  
8. Adversarial sentinels T-S4-01…15.

## Explicit non-scope

Invoice creation/issue · Stripe/payment · autonomous follow-up · OMW customer SMS/email product (S6) · visual workflow builder · shared multi-tenancy · TIS · G2.3 reopen · Slice 5+ · `auto_create_job_on_quote_acceptance=true`.

---

## Architecture findings (summary)

Full detail: `ML-P1_SLICE4_ARCHITECTURE_FINDINGS.md`.

- Live mutator: Edge `work-order-update` (tenant-only; **creates draft invoice on complete** — S5 bleed).  
- Live tech app is **inspection-centric**; status start/complete UIs largely **orphaned**.  
- Evidence columns exist on `jobs`; edge does not persist checklist/photos/findings.  
- **No** change-order runtime.  
- Status tokens today: `unscheduled` / `pending_schedule` / `scheduled` / `en_route` / `in_progress` / `on_hold` / `completed` / `cancelled` (+ unused DB extras).  
- Storage name `jobs`; office product language **Work Orders** (R-COH-07).

---

## Design freeze (pending PD ratification)

Full detail: `ML-P1_SLICE4_PLANNING_DESIGN.md`.

| Artifact | Status |
| --- | --- |
| Job state machine + live alias map | Draft frozen; new statuses proposed |
| Authorization matrix | Draft; CO approve / pricing / signature open |
| Time/mileage model | Draft frozen |
| Evidence/completion contract | Draft; signature open |
| Change-order model + FSM | Draft frozen |
| Failure/recovery | Draft frozen |
| Field + office UI plans | Draft frozen |
| Migration order + I2 checks | Draft frozen |
| Test sentinels | Draft frozen |
| Review plan | Draft frozen |

**Recommended defaults (not binding until Founder accepts PDs):**

- Keep live tokens `en_route` (On the way) and `on_hold` (Paused).  
- Add `arrived`, `no_access`, `reschedule_required`, `completion_pending`.  
- Treat “dispatched” as derived (`scheduled` + assigned tech + window).  
- Technician may **propose** CO only; may **not** self-approve.  
- Completion **blocks** while any CO is `pending_approval`.  
- Emergency out-of-scope work: **DENY** until PD-S4-01.  
- S4 writer must **not** create invoices.

---

## Open product decisions (blocking coding)

### PD-S4-01 — Emergency / safety exception

May a technician perform limited work **outside** approved quote + approved change orders before approval (life/safety)?

| Option | Meaning |
| --- | --- |
| A | **No exception** — DENY all out-of-scope work until CO approved (safest; current planning default) |
| B | **Narrow exception** — Founder-defined allowlist (e.g. make-safe only), mandatory reason + photos, automatic emergency CO draft, still non-billable until approved |
| C | Other (Founder specify) |

**Do not invent policy.** Coding cannot start without A/B/C.

### PD-S4-02 — Technician self-approval of change orders

| Option | Meaning |
| --- | --- |
| A | **Never** — tech propose only (recommended default) |
| B | Allowed for assigned tech when delta ≤ $X and/or specific SKUs |
| C | Allowed only with named capability flag on user |

### PD-S4-03 — Customer signature / acknowledgement at completion

| Option | Meaning |
| --- | --- |
| A | Required always |
| B | Required by job type / amount threshold |
| C | Optional; office may waive with reason |
| D | Not in Slice 4 (defer) |

### PD-S4-04 — Pricing authority on change orders

| Option | Meaning |
| --- | --- |
| A | Office/admin sets all prices; tech proposes quantities/scope only |
| B | Tech may price from price book only; overrides office-only |
| C | Tech may set any price; office reviews on approve |
| D | Other |

### PD-S4-05 — Vocabulary ratification

Confirm proposed storage tokens and UI labels in Planning Design §1.1 (especially NEW: `arrived`, `no_access`, `reschedule_required`, `completion_pending`; aliases `en_route`/`on_hold`).

### PD-S4-06 — Customer vs office CO approval

| Option | Meaning |
| --- | --- |
| A | Material CO always requires customer token approval; office break-glass + reason otherwise |
| B | Office may approve any CO; customer path optional |
| C | Threshold: customer required above $X |

---

## Coding readiness decision

| Gate | Result |
| --- | --- |
| Architecture inventory complete | YES |
| Design drafted | YES |
| Product decisions closed | **NO** — PD-S4-01…06 open |
| Scope expansion beyond Founder S4 ask | NO |
| Rollback/review gates defined | YES (in design) |
| Exact branch/base frozen for coding | PENDING post-PD docs amend + coding auth |

**Exact coding readiness:** **NOT READY** — disposition `SLICE4_PLANNING_REQUIRES_PRODUCT_DECISION`.

After PDs answered: amend this packet + design, set disposition `SLICE4_READY_TO_AUTHORIZE_CODING`, then Founder issues separate coding authorization line (template below).

---

## Later coding authorization template (do not use yet)

> Authorize ML-P1 Slice 4 coding on `ml/p1-s4-job-execution` / `F:\Dev\BHFOS-ml-p1-s4`  
> at base `<post-PD amend main SHA>`, implementing field execution + change orders per  
> `ML-P1_SLICE4_DECISION_PACKET.md` and `ML-P1_SLICE4_PLANNING_DESIGN.md` with PD answers  
> \<list\>. Stop before invoice/Stripe/follow-up. Neutralize invoice-on-complete.  
> Migrations only as named. Merge requires exact head-SHA auth after reviews PASS.

---

## Founder reply needed (one block)

Please answer:

1. **PD-S4-01** Emergency exception: A / B / C (+ text if B/C)  
2. **PD-S4-02** Tech CO self-approve: A / B / C (+ limits if B)  
3. **PD-S4-03** Signature: A / B / C / D  
4. **PD-S4-04** Pricing authority: A / B / C / D  
5. **PD-S4-05** Vocabulary: Accept proposed map / edits  
6. **PD-S4-06** CO customer vs office approve: A / B / C (+ $X if C)
