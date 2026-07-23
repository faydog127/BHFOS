# Decision Packet — ML-P1 Slice 8 (PD-S8-01…07)

| Field | Value |
| --- | --- |
| Disposition | **DRAFT — planning only** · awaiting Founder Category-C ratification |
| Planning base SHA | `3cd9a32a03c07eda541daf75e28ddb0ec4aa27e2` |
| Branch | `ml/p1-s8-planning` |
| Coding | **Blocked** until Category-C answers on PD-S8-01…07 |

## Purpose

Ratify product/architecture choices for Mobile Inspections, Photo Bundles, Analytics enhancements, and Global UX/IA — before any A2 code or migrations.

---

## Product decisions (DRAFT — recommended for Founder Category-C)

### PD-S8-01 — Slice composition & delivery phasing → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Single Slice 8 authorization covering all four pillars, delivered as **ordered waves** inside A2 (Inspections → Bundles → Analytics → UX), each wave with its own evidence gate before the next |
| B | Split into S8a Inspections-only; S8b Bundles; S8c Analytics/UX as separate Founder Category-C packets |
| C | Inspections-only now; park Bundles/Analytics/UX as parallel thin tracks outside S8 numbering |

**Recommend A.** Matches Founder orchestration objective while preserving stop-lines and review discipline per wave.  
**Escalate if:** capacity forces drop of a pillar mid-slice (re-open Category-C).

### PD-S8-02 — Offline-first model & cache budget → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | **Photos-first offline:** harden IndexedDB media queue (retry, conflict, size caps); inspection draft remains online-first with local autosave buffer; optional Edge `inspection-sync` only for photo metadata + draft field patches if queue depth requires it. Cache budget default **≤ 250 MB / device** with oldest-completed eviction; fail closed when over budget |
| B | Full offline-first inspection document CRDT/sync (large new surface) |
| C | Online-only; drop offline queue improvements |

**Recommend A.** Extends proven `offlineInspectionMediaQueue` without a greenfield sync product.  
**Questions for Founder:** confirm **250 MB** cap vs 100/500; max photos per inspection before warn.

### PD-S8-03 — Checklist data model → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Introduce **`inspection_checklist_templates`** + **`inspection_checklist_responses`** keyed by job type / service line; keep `inspection_findings` / `inspection_recommendations` for narrative; do **not** rename historical findings into `inspection_items` |
| B | New `inspection_items` table as Next-Phase named; migrate findings into items |
| C | Checklist only in client JSON config; no new tables |

**Recommend A.** Avoids destructive rename; matches “structured checklist per job type.”  
**Escalate if:** B requires rewriting historical inspection rows.

### PD-S8-04 — Photo capture, annotation, retention & bundles → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Required photo slots per checklist step; annotation = overlay/marker metadata (not destructive source edit); retention **default 24 months** active + soft-delete quarantine 30 days; Photo Bundles = ordered selection → **PDF** via Edge (extend or sibling of `inspection-report-pdf`); storage prefix `tenant_id/jobs/{job_id}/photos/bundles/{bundle_id}/{uuid}.jpg` for job-attached bundles; inspection paths remain under `inspections/…`; **no Stripe attach** |
| B | Unlimited retention; bundles as ZIP only |
| C | Auto-attach every photo to invoice/payment artifacts |

**Recommend A.** Aligns with Next-Phase prefix + “no Stripe attach.”  
**Questions for Founder:** retention months (12/24/36); whether customer email may include signed bundle URL.

### PD-S8-05 — Safety / quality flags in office UI → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Structured flag codes on checklist responses / findings (`safety`, `quality`, `make_safe`); surface in CRM Inspection list + Job detail badge; optional Ops filter; **never** auto-complete or auto-invoice from flags |
| B | Free-text only; no structured flags |
| C | Flags auto-create warranty/S7 jobs |

**Recommend A.** Office visibility without S7 automation.  
**Escalate if:** C (touches deferred S7).

### PD-S8-06 — Analytics metrics, refresh & ownership → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Register `/crm/analytics` (or promote Reporting) with tabs Ops / Sales / Tech; add read-only RPCs `ml_analytics_*` for: job pipeline KPIs, quote→invoice funnel, CO uptake; refresh **on page load + manual refresh** (no sub-minute polling); date-range + tenant (single-tenant V1 stamp); CSV export; **no** write RPCs, no billing from metrics |
| B | Real-time websocket dashboard |
| C | Defer analytics to post-S8 thin track |

**Recommend A.** Matches Next-Phase stop-lines.  
**Questions for Founder:** default range 30d vs 90d; whether CO uptake includes break-glass COs.

### PD-S8-07 — Global UX / IA target → **A (recommended)**

| Option | Description |
| --- | --- |
| **A** | Move toward left-nav: **Hub → Leads/CRM → Jobs → Quotes → Inspections → Analytics/Reporting → Settings**; keep Call Console/SMS/Dispatch reachable without orphaning; breadcrumbs + consistent page titles; Settings discoverability for Billing & Inspections; mobile: fix known tech/CRM layout quirks in scope — **5-icon CRM bottom bar and dark-mode are optional stretch**, not gate |
| B | Big-bang nav rewrite to exact Next-Phase list in one PR |
| C | UX polish only; no nav order changes |

**Recommend A.** Incremental IA without stranding Intake/Ops tools.  
**Escalate if:** removing Call Console / Dispatch from primary IA.

---

## Binding stop-lines (non-negotiable without Major Decision)

- No TIS product merge  
- No shared multi-tenant redesign  
- No silent job completion without S4 readiness  
- No auto-send / auto-charge / vault / Terminal  
- No analytics write RPCs or customer-facing analytics portal  
- No Stripe attach for photo bundles  
- S7 warranty/dispatch remains deferred  

## Founder response template

Reply with Category-C authorization using option letters, e.g.:

```
PD-S8: 01=A 02=A 03=A 04=A 05=A 06=A 07=A
CACHE_MB=250 RETENTION_MONTHS=24
CATEGORY-C: AUTHORIZE A2 CODING at base <exact SHA>
```

Or reject/amend individual PDs before any coding branch opens.
