# STATUS_VOCABULARY_LOCK_V1.md

## Purpose

This document freezes the **v1 live vocabulary authority** for core BHFOS entities.

It exists to stop churn by locking:

* the canonical string values allowed in the current system
* temporary alias mappings for legacy/live drift
* deprecated values that must be removed
* the authorized owner path allowed to write each entity status

This is a **reality-lock document**, not an ideal-state redesign.

If a future naming model is desired, it must be introduced in a later controlled normalization phase. Until then, this file is the source of truth for vocabulary enforcement.

---

## Authority Rule

This file supersedes aspirational status naming for live enforcement decisions.

For v1:

* current live vocabulary wins
* aliases are temporary compatibility bridges only
* deprecated values may be read/mapped during transition, but must not be treated as future-state design
* new status strings are prohibited unless explicitly added here

---

## Global Rules

### Rule V1 — Canonical Write Rule

Only canonical values may be written by newly hardened code paths unless a temporary alias write is explicitly allowed here.

### Rule V2 — Alias Rule

Aliases exist only to absorb legacy writes and preserve compatibility during cleanup.

Aliases:

* must map to exactly one canonical value
* must have an identified removal target
* must not be treated as independent states

### Rule V3 — Deprecated Rule

Deprecated values are allowed only as temporary compatibility inputs where explicitly noted.
They are not valid long-term vocabulary.

### Rule V4 — Illegal Value Rule

Any value not listed in this file as canonical or temporary alias is illegal.

### Rule V5 — Owner Rule

Status writes must route through the authorized owner path for that entity.
Direct raw writes are governance violations.

---

# 1. JOBS VOCABULARY LOCK (v1)

## 1.1 Canonical Values

* `unscheduled`
* `scheduled`
* `in_progress`
* `completed`
* `cancelled`
* `invoiced`

## 1.2 Alias Mapping

| Alias              | Canonical     | Status           |
| ------------------ | ------------- | ---------------- |
| `pending`          | `unscheduled` | Deprecated alias |
| `pending_schedule` | `unscheduled` | Deprecated alias |

## 1.3 Deprecated Values

* `pending`
* `pending_schedule`

## 1.4 Conditional / Not-Adopted Values

| Value      | Decision          | Notes                                                          |
| ---------- | ----------------- | -------------------------------------------------------------- |
| `en_route` | Not adopted in v1 | Do not add unless confirmed as active in live DB/code contract |

## 1.5 Illegal Values

Any jobs status not listed as canonical or alias above is illegal.

## 1.6 Must-Fix Breach

`invoiced` is canonical in v1 **because live code/projections already use it**, but the DB status constraint is not yet aligned.

This is a **P0 breach** and must be patched before final enforcement hardening.

## 1.7 Write Owner

Authorized status owner:

* `supabase/functions/work-order-update/index.ts`
* any DB trigger/function formally designated for job lifecycle mutation

Unauthorized:

* raw client writes to `jobs.status`
* ad hoc status updates outside the owner path

---

# 2. APPOINTMENTS VOCABULARY LOCK (v1)

## 2.1 Canonical Values

* `pending`
* `confirmed`
* `rescheduled`
* `completed`
* `cancelled`
* `no_show`

## 2.2 Alias Mapping

| Alias       | Canonical   | Status           |
| ----------- | ----------- | ---------------- |
| `scheduled` | `confirmed` | Deprecated alias |
| `approved`  | `confirmed` | Deprecated alias |

## 2.3 Deprecated Values

* `scheduled`
* `approved`

## 2.4 Illegal Values

Any appointment status not listed as canonical or alias above is illegal.

## 2.5 Notes

`confirmed` is the live v1 canonical stored value.
Do not force-rename it to `scheduled` during this freeze phase.

## 2.6 Write Owner

Authorized status owner:

* `supabase/functions/update-appointment-status/index.ts`
* other explicitly approved appointment owner paths documented in mutation rules

Unauthorized:

* raw client writes to `appointments.status`
* automation paths writing appointment status outside the authorized owner path

---

# 3. LEADS VOCABULARY LOCK (v1)

## 3.1 Canonical Values

* `new`
* `contacted`
* `qualified`
* `converted`
* `lost`

## 3.2 Alias Mapping

| Alias       | Canonical   | Status           |
| ----------- | ----------- | ---------------- |
| `scheduled` | `converted` | Deprecated alias |

## 3.3 Deprecated Values

* `scheduled`

## 3.4 Illegal Values

Any lead status not listed as canonical or alias above is illegal.

## 3.5 Critical Note

`scheduled` currently appears in active code paths and must not be ignored during the freeze.

For v1:

* treat `scheduled` as a deprecated alias only
* map it to `converted`
* remove or replace the writer later through controlled cleanup

## 3.6 Write Owner

Authorized status owner:

* `supabase/functions/lead-update-stage/index.ts` until replaced
* `supabase/functions/kanban-move/index.ts` only where still part of live lead mutation flow
* future single lead transition owner once aligned

Warning:
Lead status is still a **high-drift lane** and must be treated as unstable until owner-path consolidation is complete.

---

# 4. COMMERCIAL VOCABULARY LOCK (v1)

## 4.1 System Entity Authority

For v1, the operational commercial entity is:

* `Quote`

## 4.2 Presentation Language

For v1, the following term may be used in presentation or customer-facing language only:

* `Estimate`

## 4.3 Rule

Do not create enforcement logic that assumes a separate canonical Estimate entity unless and until the schema/entity split is formally adopted.

## 4.4 Write Owner

Authorized owner paths:

* `supabase/functions/send-estimate/index.ts`
* `supabase/functions/quote-update-status/index.ts`
* `supabase/functions/public-quote-approve/index.ts`
* DB triggers/functions officially designated for quote lifecycle events

---

# 5. PIPELINE STAGE DEMOTION LOCK (v1)

## 5.1 Authority Decision

`pipeline_stage` is **not** a canonical execution status.

## 5.2 Allowed Use

`pipeline_stage` may exist only as:

* reporting dimension
* UI grouping field
* analytics/display metadata

## 5.3 Prohibited Use

`pipeline_stage` must not:

* drive business logic
* authorize transitions
* trigger automation routing
* control permissions
* override canonical `status`

## 5.4 Enforcement Intent

Any code path that treats `pipeline_stage` as operational authority must be classified as drift and queued for cleanup.

---

# 6. SUPERSESSION NOTE

The existing `STATUS_CONTRACTS.md` should be treated as **outdated / superseded for vocabulary enforcement** until it is rewritten to match this v1 lock.

This file is the vocabulary source of truth for immediate stabilization.

---

# 7. IMMEDIATE BREACH PATCH LIST

## P0

* Add `invoiced` to the jobs DB status constraint or stop code from writing it.

## P0

* Choose `unscheduled` as the only canonical pre-schedule jobs state.
* Stop allowing fresh writes of `pending` and `pending_schedule`.

## P0

* Stop treating `pipeline_stage` as execution authority.

## P1

* Replace lead status writer behavior that emits `scheduled`.

## P1

* Normalize appointment aliases so `confirmed` remains canonical and `scheduled`/`approved` are compatibility only.

---

# 8. FREEZE STATEMENT

V1 authority uses **current live vocabulary**, not aspirational vocabulary.

The order of operations is:

1. lock live vocabulary
2. patch active contract breaches
3. freeze naming
4. enforce mutation ownership
5. normalize later in a controlled v2 pass

No new status names should be introduced during v1 hardening unless they are added to this file first.

