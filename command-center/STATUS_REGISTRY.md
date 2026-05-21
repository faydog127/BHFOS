# STATUS_REGISTRY.md

## Purpose

This document is the flat operational inventory of live status values in BHFOS.

It exists to:

* record currently observed status strings by entity
* distinguish canonical values from aliases and deprecated values
* identify write owners
* identify source files where values are written, normalized, or enforced

This is a **reality reference**, not an aspirational design document.

---

## Relationship to Other Governance Files

* `STATUS_VOCABULARY_LOCK_V1.md` = v1 naming law
* `STATUS_REGISTRY.md` = observed/live inventory
* `REALITY_CHECK_TEMPLATE.md` = discovery method
* `DECISION_LOG.md` = lock/closure layer

If this registry conflicts with live code or DB, update the registry after verification.
If this registry conflicts with the vocabulary lock, the conflict must be logged and resolved through a patch packet or controlled decision.

---

## Registry Fields

| Field         | Meaning                                                           |
| ------------- | ----------------------------------------------------------------- |
| Entity        | Business object (`jobs`, `leads`, `appointments`, `quotes`, etc.) |
| Value         | Observed status string                                            |
| Canonical_V1  | Whether the value is canonical in `STATUS_VOCABULARY_LOCK_V1.md`  |
| Alias_Maps_To | Canonical target if value is treated as alias                     |
| Deprecated    | Whether the value is deprecated in v1                             |
| Write_Owner   | Authorized owner path currently responsible for writes            |
| Source_Files  | Known files where value is written, normalized, or enforced       |
| Notes         | Important drift, risk, or usage context                           |

---

# 1. JOBS STATUS REGISTRY

| Entity | Value              | Canonical_V1 | Alias_Maps_To | Deprecated | Write_Owner                                                  | Source_Files                                                                                             | Notes                                                                |
| ------ | ------------------ | -----------: | ------------- | ---------: | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| jobs   | `unscheduled`      |          Yes |               |         No | `supabase/functions/work-order-update/index.ts`              | `STATUS_VOCABULARY_LOCK_V1.md`; `src/lib/jobStatus.js`; `supabase/functions/work-order-update/index.ts`  | Canonical v1 pre-schedule jobs state                                 |
| jobs   | `scheduled`        |          Yes |               |         No | `supabase/functions/work-order-update/index.ts`              | `STATUS_VOCABULARY_LOCK_V1.md`; `src/lib/jobStatus.js`                                                   | Canonical v1                                                         |
| jobs   | `in_progress`      |          Yes |               |         No | `supabase/functions/work-order-update/index.ts`              | `STATUS_VOCABULARY_LOCK_V1.md`; `src/lib/jobStatus.js`                                                   | Canonical v1                                                         |
| jobs   | `completed`        |          Yes |               |         No | `supabase/functions/work-order-update/index.ts`              | `STATUS_VOCABULARY_LOCK_V1.md`; `src/lib/jobStatus.js`                                                   | Canonical v1                                                         |
| jobs   | `cancelled`        |          Yes |               |         No | `supabase/functions/work-order-update/index.ts`              | `STATUS_VOCABULARY_LOCK_V1.md`; `src/lib/jobStatus.js`                                                   | Canonical v1                                                         |
| jobs   | `invoiced`         |          Yes |               |         No | `supabase/functions/work-order-update/index.ts`; DB contract | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/migrations/20260418171500_p0_vocab_legalize_jobs_invoiced.sql` | Canonical v1; previously a live DB/code mismatch                     |
| jobs   | `pending`          |           No | `unscheduled` |        Yes | Legacy / deprecated                                          | `STATUS_VOCABULARY_LOCK_V1.md`; `src/lib/jobStatus.js`                                                   | Deprecated alias in v1                                               |
| jobs   | `pending_schedule` |           No | `unscheduled` |        Yes | Legacy / deprecated                                          | `STATUS_VOCABULARY_LOCK_V1.md`; `src/lib/jobStatus.js`; `supabase/functions/work-order-update/index.ts`  | Deprecated alias in v1                                               |
| jobs   | `en_route`         |           No |               |        Yes | Legacy / unresolved                                          | `STATUS_VOCABULARY_LOCK_V1.md`; DB contract search / legacy code paths if present                        | Not adopted in v1; still potentially allowed in DB contract          |
| jobs   | `started`          |           No |               |        Yes | Legacy / unresolved                                          | DB contract / legacy code paths                                                                          | Legacy value still noted as residual risk                            |
| jobs   | `on_hold`          |           No |               |        Yes | Legacy / unresolved                                          | DB contract / legacy code paths                                                                          | Legacy value still noted as residual risk                            |
| jobs   | `UNSCHEDULED`      |           No | `unscheduled` |        Yes | Legacy DB default (fixed in repo)                            | `supabase/migrations/20260419093000_db_tighten_jobs_status_contract_v1.sql`                               | Fixed by micro-migration (pending deploy to non-local envs)          |

---

# 2. LEADS STATUS REGISTRY

| Entity | Value       | Canonical_V1 | Alias_Maps_To | Deprecated | Write_Owner                                                                                         | Source_Files                                                                                                                | Notes                                                                 |
| ------ | ----------- | -----------: | ------------- | ---------: | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| leads  | `new`       |          Yes |               |         No | `supabase/functions/lead-update-stage/index.ts`; `supabase/functions/kanban-move/index.ts`          | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/lead-update-stage/index.ts`                                             | Canonical v1                                                          |
| leads  | `contacted` |          Yes |               |         No | `supabase/functions/lead-update-stage/index.ts`; `supabase/functions/kanban-move/index.ts`          | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/lead-update-stage/index.ts`                                             | Canonical v1                                                          |
| leads  | `qualified` |          Yes |               |         No | `supabase/functions/lead-update-stage/index.ts`; `supabase/functions/kanban-move/index.ts`          | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/lead-update-stage/index.ts`                                             | Canonical v1                                                          |
| leads  | `converted` |          Yes |               |         No | `supabase/functions/lead-update-stage/index.ts`; `supabase/functions/public-quote-approve/index.ts` | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/public-quote-approve/index.ts`                                          | Canonical v1; quote-accept progression now writes `converted`         |
| leads  | `lost`      |          Yes |               |         No | `supabase/functions/lead-update-stage/index.ts`; `supabase/functions/kanban-move/index.ts`          | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/lead-update-stage/index.ts`                                             | Canonical v1                                                          |
| leads  | `scheduled` |           No | `converted`   |        Yes | Legacy / deprecated                                                                                 | `STATUS_VOCABULARY_LOCK_V1.md`; prior `supabase/functions/public-quote-approve/index.ts` behavior; lead compatibility logic | Deprecated alias in v1                                                |
| leads  | `archived`  |           No |               |        Yes | Legacy / deprecated                                                                                 | prior `supabase/functions/lead-update-stage/index.ts` behavior                                                              | No longer canonical; removed from active write logic in patched paths |

---

# 3. APPOINTMENTS STATUS REGISTRY

| Entity       | Value         | Canonical_V1 | Alias_Maps_To | Deprecated | Write_Owner                                             | Source_Files                                                                     | Notes                                |
| ------------ | ------------- | -----------: | ------------- | ---------: | ------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------ |
| appointments | `pending`     |          Yes |               |         No | `supabase/functions/update-appointment-status/index.ts` | `STATUS_VOCABULARY_LOCK_V1.md`; appointment migrations / shared utils            | Canonical v1                         |
| appointments | `confirmed`   |          Yes |               |         No | `supabase/functions/update-appointment-status/index.ts` | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/_shared/appointmentUtils.ts` | Canonical v1 stored/normalized value |
| appointments | `rescheduled` |          Yes |               |         No | `supabase/functions/update-appointment-status/index.ts` | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/_shared/appointmentUtils.ts` | Canonical v1                         |
| appointments | `completed`   |          Yes |               |         No | `supabase/functions/update-appointment-status/index.ts` | `STATUS_VOCABULARY_LOCK_V1.md`                                                   | Canonical v1                         |
| appointments | `cancelled`   |          Yes |               |         No | `supabase/functions/update-appointment-status/index.ts` | `STATUS_VOCABULARY_LOCK_V1.md`                                                   | Canonical v1                         |
| appointments | `no_show`     |          Yes |               |         No | `supabase/functions/update-appointment-status/index.ts` | `STATUS_VOCABULARY_LOCK_V1.md`                                                   | Canonical v1                         |
| appointments | `scheduled`   |           No | `confirmed`   |        Yes | Legacy / compatibility only                             | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/_shared/appointmentUtils.ts` | Deprecated alias in v1               |
| appointments | `approved`    |           No | `confirmed`   |        Yes | Legacy / compatibility only                             | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/_shared/appointmentUtils.ts` | Deprecated alias in v1               |

---

# 4. COMMERCIAL STATUS / NAMING REGISTRY

## 4.1 Entity Authority

| Entity              | Value      | Canonical_V1 | Alias_Maps_To               | Deprecated | Write_Owner       | Source_Files                                                                                                                                                                       | Notes                                                              |
| ------------------- | ---------- | -----------: | --------------------------- | ---------: | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| commercial_entity   | `Quote`    |          Yes |                             |         No | quote owner paths | `STATUS_VOCABULARY_LOCK_V1.md`; `supabase/functions/send-estimate/index.ts`; `supabase/functions/quote-update-status/index.ts`; `supabase/functions/public-quote-approve/index.ts` | Operational commercial entity in v1                                |
| commercial_language | `Estimate` |           No | `Quote` (presentation only) |         No | N/A               | `STATUS_VOCABULARY_LOCK_V1.md`                                                                                                                                                     | Presentation language only in v1; not separate enforced entity yet |

---

# 5. PIPELINE STAGE REGISTRY

| Entity         | Value                    | Canonical_V1 | Alias_Maps_To | Deprecated | Write_Owner                       | Source_Files                                                                                                               | Notes                                  |
| -------------- | ------------------------ | -----------: | ------------- | ---------: | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| pipeline_stage | reporting/grouping field |          N/A | N/A           |        N/A | legacy UI / CRM / reporting paths | `STATUS_VOCABULARY_LOCK_V1.md`; `REVIEW_GATE_UPDATE_V1.md`; `src/pages/crm/Leads.jsx`; `src/services/automationService.js` | Not a canonical execution status in v1 |

### Pipeline Stage Rule

`pipeline_stage` may be used only for:

* reporting
* UI grouping
* analytics/display metadata

It may not be used for:

* transition authority
* mutation authorization
* automation triggering
* canonical status override

---

# 6. OPEN DRIFT / DEFERRED ITEMS

These are known but not fully resolved in v1.

| Area           | Issue                                                                           | Status                                  |
| -------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| jobs           | DB contract still allows several legacy values beyond v1 lock                   | Deferred for controlled tightening pass |
| jobs           | Uppercase DB default `UNSCHEDULED` mismatches lowercase canonical `unscheduled` | Fixed in repo; pending deploy to non-local |
| leads          | High-drift lane; owner consolidation not complete                               | Deferred                                |
| appointments   | Alias compatibility remains for `scheduled` / `approved`                        | Deferred                                |
| pipeline_stage | Field still exists and is still written for reporting/grouping                  | Allowed, but execution authority prohibited |

---

# 7. MAINTENANCE RULE

Update this registry only when one of the following is true:

* a Reality Check confirms new live behavior
* a patch packet changes live vocabulary or ownership
* a decision log entry changes canonical treatment

Do not update this file based on aspiration alone.

---

# 8. OUTCOME

This registry provides:

* one flat inventory of live status values
* one reference point for builders and reviewers
* one place to compare reality against the v1 lock

This is the **operational manifest** for status vocabulary in BHFOS.
