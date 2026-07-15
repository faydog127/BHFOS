# R1 — Identity & Relationship Safety Plan

**Status:** R1A implementation in progress on `stabilize/r1a-property-relationship-safety`  
**Base tip:** `b3d2599d2ba3c4f994a7e1ed8254496df4913fa2`  
**Worktree used for audit:** `F:\Dev\BHFOS-stabilize-r1-plan` (detached `origin/main`)  
**R1A worktree:** `F:\Dev\BHFOS-stabilize-r1a-property`  
**Dirty tree `F:\Dev\BHFOS`:** not used  
**Backlog seeds:** B-001, B-002, B-011, B-014 (and related embed/identity items)

### R1A production read-only verification (2026-07-15)

| Question | Result |
| --- | --- |
| Invoice `property_id` populated? | **0** non-null rows observed |
| Invoice `service_address` column? | **Absent** (customer_name/email/phone present) |
| jobs→properties PostgREST relation? | **None** (`Could not find a relationship between 'jobs' and 'properties'`) |
| Live `/pay/:token` path | `PaymentPage` → `public-invoice` + `public-pay` (**not** `paymentService`) |
| `paymentService` imported in src? | **No** — still fixed as release-critical dead path |
| leads.property_id → properties | Still invalid (UUID vs bigint; embed fails) |

---

## 1. Confirmed production type contracts

| Contract | Production reality | Local migration assumption | V1 ruling |
| --- | --- | --- | --- |
| `leads.property_id` | **uuid** | uuid FK → `properties(id)` | Treat as opaque pointer; **do not join** to hosted `properties` |
| `public.properties.id` | **bigint** (marketing/scouting) | uuid in `20260101_…` | Not CRM SoT |
| Property street column | **`address_line_1`** | `address1` in money-loop DDL | Never select `address1` from hosted `properties` |
| Service address SoT (field) | `property_formatted_address` → inspection/job `service_address` → `leads.address` | N/A | Keep hotfix priority from #37/#38 |
| `technicians.id` | uuid PK | uuid | **Assignment FK target** |
| `technicians.user_id` | uuid unique → `auth.users` | uuid | **Auth mapping only** |
| `jobs.technician_id` | FK → **`technicians.id`** (phase 1.5) | Earlier migration stored `user_id` | Writes must be `technicians.id` |
| `appointments.technician_id` | FK → **`technicians.id`** (phase 1.5) | Earlier FK to `user_id` | Writes must be `technicians.id` |
| `inspections.technician_id` | FK → **`technicians.id`** | uuid | Same |

Hotfixes verified present on tip:

- `inspectionFieldAddress.js`: `hydrateLeadsWithProperties`, numeric-id guard, `property_formatted_address`, no nested embed select
- Tech inspection pages use `LEAD_FIELD_SELECT` + hydrate

---

## 2. Property relationship findings

### Classification legend

- **SAFE** — no PostgREST lead→properties embed; uses freeform / denormalized address; or numeric-only hydrate with catch
- **UNSAFE** — active path can fail load or write wrong address due to embed/FK/column mismatch
- **LEGACY BUT CONTAINED** — orphaned / unrouted / fallback chain eventually reaches `*`
- **UNKNOWN** — needs production read-only confirmation
- **V2 DEFER** — full CRM property model redesign

### Unsafe (active)

| File | Location | Workflow | Assumption | Production reality | Failure mode | Smallest safe fix | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/services/paymentService.js` | `getInvoiceByToken` ~L27–32 | Public pay | `lead → properties!fk_leads_property(address1…)` | No FK; bigint id; no `address1` | Pay page load / address blank / PostgREST error | Remove embed; select `leads.address`, `property_formatted_address`, invoice denorm fields | Public invoice/pay select contract + smoke |
| `src/services/paymentService.js` | `getInvoiceById` ~L56 | Office invoice | `property:properties!fk_invoices_property(*)` | Same drift if invoice.property_id uuid vs bigint properties | Invoice detail fail | Drop embed; use invoice/lead address columns | Invoice-by-id select contract |
| `src/pages/crm/proposals/ProposalBuilder.jsx` | `fetchLeadsWithFallback` L211–212 | Estimates/quotes | Tries `property:property_id(address1…)` before `*` | Embed fails; falls through to `*` if relation error handler catches | Extra failed requests; if error classifier wrong → hard fail | Remove embed variants; select lead address columns only; reuse address helper | Lead fetch fallback unit/source test |
| `src/pages/crm/AuditInspector.jsx` | select ~L57 | Audit/debug CRM | `property:properties(address1…)` | Same | Screen fail | Remove embed or gate behind feature | Source ban test |
| `src/pages/tech/TechSchedule.jsx` | jobs select L45 | Tech schedule (orphaned route) | `jobs → properties(address1…)` | Unclear jobs↔properties FK; `address1` wrong | Query error if route remounted | Use `jobs.service_address` / lead address | If remounted in R3, contract test |
| `src/pages/tech/TechDashboard.jsx` | jobs select ~L35 | Orphaned tech dashboard | Nested `properties(address1…)` | Same | Same | Prefer `service_address` | Contained until routed |
| `src/components/crm/jobs/JobManager.jsx` | select ~L27 | Jobs UI helper | Nested `properties(address1)` | Same | List fail | Prefer `service_address` | Source/contract |

### Safe (keep)

| File | Pattern | Why SAFE |
| --- | --- | --- |
| `src/lib/inspectionFieldAddress.js` | Separate hydrate; UUID skip; catch; `address_line_1` | Hotfix contract |
| Tech inspection session/review + `InspectionFieldCustomerStep` | `LEAD_FIELD_SELECT` + hydrate; freeform lead address write | Hotfix #37/#38 |
| `InspectionEditor.jsx` | Selects lead `property_id` scalar only (no embed) | Pointer only |

### Legacy but contained / lower priority

| File | Note |
| --- | --- |
| `TechSchedule.jsx` / `TechDashboard.jsx` | Not in `TechRoutes.jsx` — still fix if touched; else R1A optional cleanup only if zero risk |
| `CallConsole.jsx` / `InspectionReport.jsx` | Uses `lead.address1` form fields — may be empty in prod (leads use `address`); not PostgREST embed — classify **UNKNOWN** integrity, not embed outage |
| `QuoteView.jsx` mock `address1` | Mock data only |

### V2 defer

- Redesign CRM `properties` table / unify with marketing properties  
- Backfill all historical `leads.property_id` to a new CRM property entity  
- Multi-tenant property graph

---

## 3. Technician identity findings

### Authoritative V1 contract (recommended — minimize change)

```
auth.users.id  ←→  technicians.user_id   (login / RLS actor)
technicians.id  ←→  jobs.technician_id
                ←→  appointments.technician_id
                ←→  inspections.technician_id
```

**Meaning:**

- **Auth identity** = `auth.users.id`  
- **Roster identity** = `technicians.id`  
- **Assignment columns always store roster identity (`technicians.id`)**  
- Resolve login → roster via `technicians.user_id = auth.uid()`

### Conflicting migrations (historical)

| Migration | Direction |
| --- | --- |
| `20260416220000_unify_technician_id_on_user_id.sql` | Forced `jobs`/`appointments.technician_id` = `user_id` |
| `20260512184500_phase1_fix_appointment_technician_fk.sql` | Reversed appointments → `technicians.id` |
| `20260512205000` + `20260512210000_phase1_5_jobs_technician_fk.sql` | Backfilled jobs user_id→id; FK to `technicians.id` |

**Latest wins:** assignment FKs → `technicians.id`.

### Code alignment

| Area | Behavior | Risk |
| --- | --- | --- |
| Tech PWA (`TechQueue`, `TechJobDetail`, `TechSchedule`) | Look up tech by `user_id`, filter jobs by `tech.id` | **SAFE** |
| `AppointmentScheduler.jsx` | Select writes `tech.id` | **SAFE** |
| `InspectionEditor.jsx` | Assigns technician roster id | **SAFE** (verify create payload) |
| `inspection-report-pdf` | Loads technician by `eq('id', inspection.technician_id)` | **SAFE** |
| **`Jobs.jsx`** | SelectItem `value={tech.user_id}`; `resolveTechnicianSelection` returns `user_id`; writes that to `jobs.technician_id` | **UNSAFE** — FK / silent mis-assign |
| **`Schedule.jsx` (dispatch)** | Sets `dispatch_id: tech.user_id \|\| tech.id`; writes `technician_id: dispatchTechnicianId` | **UNSAFE** — same |
| `TechDashboard.jsx` comment | Mentions filter by userId | Orphaned; misleading |

### Edge functions

| Function | Notes |
| --- | --- |
| `work-order-update` | Passes `technician_id` through; assumes caller sends correct id |
| `create-appointment` / `update-appointment-status` | Accept `technician_id`; PostgREST join `technicians (full_name)` implies FK to `technicians.id` |
| PDF | Uses `technicians.id` |

---

## 4. Unsafe active code locations (implementation hit list)

### Property / address

1. `src/services/paymentService.js` — public + auth invoice selects  
2. `src/pages/crm/proposals/ProposalBuilder.jsx` — `fetchLeadsWithFallback`  
3. `src/pages/crm/AuditInspector.jsx` — lead property embed  
4. `src/components/crm/jobs/JobManager.jsx` — jobs→properties embed  
5. `src/pages/tech/TechSchedule.jsx` / `TechDashboard.jsx` — jobs→properties embed (orphaned but dangerous if remounted)

### Technician

6. `src/pages/crm/Jobs.jsx` — writes `user_id` into `technician_id`  
7. `src/pages/crm/Schedule.jsx` — dispatch writes `user_id` via `dispatch_id`

---

## 5. Safe fallback patterns already in use (preserve)

1. **Lead field select without embeds** — `LEAD_FIELD_SELECT`  
2. **Numeric-only properties hydrate + swallow errors** — `hydrateLeadsWithProperties`  
3. **Address priority** — attached property → `property_formatted_address` → inspection/job service address → `leads.address`  
4. **New lead from field** — freeform `leads.address` + `property_formatted_address` only (no properties insert)  
5. **Tech auth bootstrap** — `technicians.user_id = auth.uid()` then use `technicians.id` for queries  

Do **not** regress these in R1.

---

## 6. Proposed shared helpers

### A. Expand / centralize address resolution (prefer reuse)

**Module:** `src/lib/inspectionFieldAddress.js` (or rename-neutral export surface)

Add thin CRM-facing wrappers (names indicative):

- `LEAD_ADDRESS_SELECT` — columns only: `address, property_formatted_address, property_id, …`  
- `resolveLeadServiceAddress(lead, extras)` — already mostly `resolveServiceAddress`  
- Document: **never** export a PostgREST embed string for property

Avoid a second parallel address library.

### B. Technician identity helper (new small module)

**Proposed:** `src/lib/technicianIdentity.js`

```text
resolveTechnicianRosterId({ technicians, value }) → technicians.id | null
resolveTechnicianAuthUserId({ technicians, value }) → user_id | null  // display/debug only
assertAssignmentIdIsRosterId(value) // dev/test helper
TECHNICIAN_ROSTER_SELECT = 'id, user_id, full_name, is_active'
```

Rules baked into helper JSDoc:

- UI selects for assignment must use `technicians.id`  
- Mapping from session uses `user_id`  

---

## 7. Proposed tests and guardrails

### Static / source contract tests (Playwright or node assert specs)

1. **Ban nested lead→property embeds** in active paths:
   - Fail if `src/**` matches `property:property_id(` or `properties!fk_leads_property`  
   - Allowlist empty (or only docs)

2. **Ban jobs nested `properties (` embeds** in tech/CRM job loaders (or require `service_address`)

3. **Technician write contract:**
   - `Jobs.jsx` / `Schedule.jsx` must not use `SelectItem value={tech.user_id}` for assignment  
   - Prefer assert helper usage / `value={tech.id}`

### Focused behavior tests

4. PaymentService select string does not include property embeds; includes lead address fields  
5. ProposalBuilder lead fetch does not attempt property embed  
6. Jobs assignment payload uses roster id (unit with mock tech list)  
7. Existing `inspection-field-address-schema.spec.js` remains green  

### Review-gate / docs

8. Short note in `docs/stabilization/` or helper header: forbidden patterns  
9. Optional CI grep step in existing smoke/lint — **prefer test file over new framework**  
10. Migration immutability: **out of R1 code**; keep as R8 hygiene unless a one-line check is free

---

## 8. Files expected to change

### R1A — Property relationship safety

- `src/services/paymentService.js`
- `src/pages/crm/proposals/ProposalBuilder.jsx`
- `src/pages/crm/AuditInspector.jsx`
- `src/components/crm/jobs/JobManager.jsx`
- Optionally orphaned: `TechSchedule.jsx`, `TechDashboard.jsx` (same PR if tiny; else leave with TODO + ban test exemption until R3)
- `src/lib/inspectionFieldAddress.js` — only if exporting shared select helpers
- `tests/smoke/*` contract specs

### R1B — Technician identity lock

- `src/lib/technicianIdentity.js` (**new**, small)
- `src/pages/crm/Jobs.jsx`
- `src/pages/crm/Schedule.jsx`
- Focused tests
- Docs comment in ownership map (optional cross-link)

### R1C — Guards / regression nets

- New/updated smoke contract tests  
- Possibly `package.json` script `test:identity-contracts` calling the same specs  
- No workflow YAML change unless checks already cover `npm test` (they don’t today) — **keep guards as smoke tests run in PR checklist / local CI optional**

---

## 9. Migration required?

**No** for R1.

Rationale:

- Hotfixes already prove app-level fallbacks work without schema change  
- Redesigning properties is V2  
- Technician FK already points at `technicians.id` per latest migrations; fix is **write-path alignment**, not a new migration  

If production probe shows `jobs.technician_id` still contains many `user_id` values despite FK, that becomes **UNKNOWN → read-only verification** before any data backfill migration (separate approved release).

---

## 10. Migration risk

| Item | Risk |
| --- | --- |
| R1A/R1B/R1C as planned | **None** (no migration) |
| Accidental property redesign | High — forbidden |
| Silent data backfill of technician ids | Medium — do not include without approval + inventory query |

---

## 11. Bounded PR sequence

### R1A — Remove unsafe property relationship assumptions

| Field | Value |
| --- | --- |
| Goal | Ban/fix active PostgREST property embeds; preserve address fallbacks |
| Includes | paymentService, ProposalBuilder lead fetch, AuditInspector, JobManager; shared select helpers if needed |
| Excludes | Technician changes; property schema; money status authority |
| Branch | `stabilize/r1a-property-relationship-safety` |
| Worktree | `F:\Dev\BHFOS-stabilize-r1a` from `origin/main` |
| Acceptance | No forbidden embed patterns in owned files; public pay + quote lead load succeed with lead address; inspection field tests still pass |

### R1B — Lock technician identity usage

| Field | Value |
| --- | --- |
| Goal | Assignment UIs write `technicians.id` only |
| Includes | Jobs.jsx, Schedule.jsx, `technicianIdentity.js`, tests |
| Excludes | Property work; remounting TechSchedule |
| Branch | `stabilize/r1b-technician-identity-contract` |
| Depends on | R1A merged preferred (low file overlap — can parallelize if orchestrator assigns different files) |
| Acceptance | Assign tech from Jobs + Dispatch; DB value equals `technicians.id`; tech queue still shows job |

**Overlap note:** `Schedule.jsx` may also touch address display — keep address fixes in R1A only; R1B only technician fields.

### R1C — Static guards and regression tests

| Field | Value |
| --- | --- |
| Goal | Prevent recurrence |
| Includes | Repo-wide source contract tests; document forbidden patterns |
| Excludes | Feature changes |
| Branch | `stabilize/r1c-identity-guardrails` |
| Depends on | R1A + R1B merged so bans don’t fail on known violators |
| Acceptance | Contract suite fails if embed/`user_id` assignment pattern reintroduced |

**Do not combine A+B+C** into one PR: different risk domains and clearer rollback.

---

## 12. Acceptance criteria (R1 complete)

1. No active `property:property_id(` or `properties!fk_leads_property` in `src/`  
2. Public pay invoice load does not depend on properties embed  
3. Quote/estimate lead picker loads without property embed  
4. Inspection field address tests remain green  
5. Jobs + Dispatch assignment persist `technicians.id`  
6. Tech PWA queue still resolves via `user_id` → `id`  
7. Contract tests exist and pass  
8. No migration  
9. No production schema change  
10. Docs: this plan + backlog dispositions updated after merge  

---

## 13. Deployment and rollback

| Topic | Guidance |
| --- | --- |
| Deploy | Frontend-only Hostinger deploy after each PR or after R1A–C bundle — **human approved**, clean worktree |
| Edge functions | No redeploy unless a function file changes (not planned) |
| Rollback | Redeploy previous Hostinger asset pair; no DB rollback |
| Smoke | Synthetic: open public invoice token path (if available safely), CRM quote lead list, assign technician on job, tech queue still lists job; inspection open with UUID `property_id` |

---

## 14. Explicit V2 deferrals

- Unified CRM property entity replacing marketing `properties`  
- Migrating `leads.property_id` to a valid FK  
- Multi-property customers  
- Full user/technician role redesign  
- Rewriting dispatch board architecture  
- Invoice/payment authority (R5)  
- Deploy tooling on main (R8)  

---

## Unknowns requiring production read-only verification

1. Whether `invoices.property_id` is populated in prod and of what type  
2. Whether `jobs` has any PostgREST relationship to `properties` (TechSchedule embed)  
3. Distribution of `jobs.technician_id` values still equal to `technicians.user_id` vs `technicians.id`  
4. Whether `paymentService.getInvoiceByToken` is on the live `/pay/:token` path or superseded by edge `public-pay`  
5. Whether ProposalBuilder’s relation-error fallback always triggers (classifier robustness)

**Method:** read-only SQL/API probes with service role; no writes; no customer contact.

---

## Most dangerous active code path

**`paymentService.getInvoiceByToken`** — customer-facing payment load embeds broken lead→properties relationship with non-existent `address1` columns. Closely followed by **`Jobs.jsx` / `Schedule.jsx` writing `technicians.user_id` into `jobs.technician_id`** against an FK to `technicians.id`.

---

## Change control

| Action | Status |
| --- | --- |
| Implementation | **Not started** — awaiting explicit approval |
| Deployment | None |
| Production modification | None |
