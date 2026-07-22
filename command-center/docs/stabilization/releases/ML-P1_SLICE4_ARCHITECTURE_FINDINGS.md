# ML-P1 Slice 4 — Architecture Findings

| Field | Value |
| --- | --- |
| Planning base | `2a03d876126329a5c97b36fce4414b1c91e56f3c` |
| Production UI baseline | Hostinger `d87f2e6e923652b05ea3518a7e9a4358b4cce178` |
| Slices 1–3 | Coherence **PASS** · S3 validation **PASS** |
| Non-blocking residuals | R-COH-08, R-COH-12, R-COH-14 |
| Canonical Quotes route | `/tvg/crm/quotes` (tenant path; App redirects estimates/proposals → quotes) |
| Re-verified | 2026-07-22 on worktree `F:\Dev\BHFOS-ml-p1-s4-plan` @ `2a03d87…` |

---

## 1. Live surface inventory

### Office (routed)

| Surface | Path | Mutates jobs? |
| --- | --- | --- |
| Work Orders board | `src/pages/crm/Jobs.jsx` → `/crm/jobs` | Yes — via `jobService.updateWorkOrder` |
| Dispatch | `src/pages/crm/Schedule.jsx` → `/crm/dispatch` | Yes — start/complete |
| Calendar | `src/pages/crm/appointments/AppointmentScheduler.jsx` → `/crm/calendar` | Indirect — appointment sync trigger |
| Hub / Flow | CRMHub, FlowConsole | Read / navigate |
| Inspections | `/crm/inspections*` | Separate evidence path; may link quote/job |

### Technician mobile (routed under `/:tenantId/tech/*`)

| Surface | Path | Mutates job status? |
| --- | --- | --- |
| Tech queue | `TechQueue.jsx` | No — navigates to detail |
| Tech job detail | `TechJobDetail.jsx` | No — starts **inspection** |
| Tech schedule | `TechSchedule.jsx` | No — read appointments |
| Inspection session | tech inspection routes | Photos/findings on **inspections**, not job FSM |

### Orphan / not in `App.jsx` (must not be treated as live product)

| Surface | Path | Notes |
| --- | --- | --- |
| TechDashboard | `TechDashboard.jsx` | Start/complete status; skips `en_route` |
| JobCompletion | `jobs/JobCompletion.jsx` | Office complete + email |
| JobCompletionWizard | `components/tech/JobCompletionWizard.jsx` | Checklist/photos/signature UI; evidence payload **stripped** by edge `buildPatch` |
| JobManager | `components/crm/jobs/JobManager.jsx` | Legacy table |

### Writers

| Writer | Authority today | S4 disposition |
| --- | --- | --- |
| Edge `work-order-update` | Tenant JWT only; **no role / assignment check** | Replace or wrap as sole S4 execution writer; **remove invoice-on-complete** |
| `jobService.updateWorkOrder` | Client facade → edge | Thin client only |
| `jobService.createJob` | Direct insert possible | Freeze for S3-accepted jobs; no alternate create from field |
| RPC `ml_p1_s3_ensure_job_for_accepted_quote` | S3 create → `unscheduled` | Remains create authority; S4 does not re-create |
| Trigger `sync_job_schedule_from_appointment` | May promote → `scheduled` | Keep; document as schedule writer |
| Direct client `.from('jobs').update` | RLS allows tenant UPDATE | **DENY** for status/money fields via RLS + RPC-only |

### Status vocabulary (live)

**DB check includes:** `pending`, `unscheduled`, `pending_schedule`, `scheduled`, `en_route`, `started`, `in_progress`, `on_hold`, `ready_to_invoice`, `open`, `invoiced`, `completed`, `closed`, `cancelled`.

**Edge FSM writable subset:** `unscheduled` ↔ `pending_schedule` ↔ `scheduled` → `en_route` → `in_progress` ↔ `on_hold` → `completed` \| `cancelled`.

**Gaps vs Founder candidate list:** no `arrived`, `no_access`, `reschedule_required`, `completion_pending`, `dispatched`, `paused` (paused ≈ `on_hold`), `on_the_way` (≈ `en_route`), `created` (≈ `unscheduled` post-S3).

### Time / mileage / OMW

- `en_route` exists; **no** dedicated tech “On my way” control on live tech routes.
- **No** arrival timestamp columns, mileage, or job clock fields found as first-class writers.
- Inspection has `started_at`; jobs do not have a verified travel/on-site clock model.
- Customer OMW **comms** remain S6 per roadmap; S4 owns statuses + capture for later comms.

### Evidence columns (schema exists; writer incomplete)

On `jobs` (Packet 006): `execution_checklist`, `execution_findings`, `execution_photos`, `technician_notes`, `customer_summary`, `scope_summary`, etc.

Edge `buildPatch` does **not** persist checklist/findings/photos. Wizard uses blob URLs — not production storage.

### Change orders

**None in runtime.** No `change_orders` table, RPC, or edge writer. Document-system blueprint and money-state “minimal flag / new quote” language only. Quote revise (S2) is pre-accept only.

### Authz

- S2 matrix (`mlP1S2RoleAuthz.js`) covers quote caps only.
- Money-State §11 says technician may complete if assigned — **not enforced**.
- Partner / customer field actions not defined for jobs.

### Naming (R-COH-07)

- Storage: `public.jobs`
- Office nav / product: **Work Orders**
- S4 planning keeps storage name `jobs`; customer/office UI continues **Work Order** unless Founder renames later (out of S4 coding unless decided).

### Critical S5 bleed

`work-order-update` **creates draft invoice on complete**. Slice 4 boundary forbids invoice creation — must be removed/gated off for S4 path.

---

## 2. Architectural conclusions

1. **One canonical server writer** for field execution transitions + evidence + time events (RPC or hardened edge; deny direct status UPDATE).
2. **Two-layer model retained** (DR-2026-03-18): dispatch/execution status writable; operational/invoice stage derived — do not invent invoice statuses inside S4 FSM.
3. **Change orders are new first-class domain** in S4 (Founder planning expansion beyond prior “minimal flag” deferral).
4. **Tech app must be rebuilt around job execution**, not inspection-only; inspection remains linked evidence source where used.
5. **Orphan completion UIs** are reference only until replaced by S4 field/office UI.
6. **Product policy gaps** (emergency work, tech CO self-approve, signature, pricing authority) block coding authorization — see Decision Packet.
