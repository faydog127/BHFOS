# ML-P1 Slice 1 — Implementation Evidence (docs)

> Base: `2867d2891994f1ec9734c7e2be3e84b216cb144f`  
> Branch: `ml/p1-s1-customer-quote-foundation`  
> **No migration. No deploy. No issue/approve/job/invoice/live pay.**

## Delivered

| Item | Location |
| --- | --- |
| Estimates create DENY (app) | `src/lib/mlP1S1EstimatesDeny.js` + `EstimateEditorModal.jsx` (no insert attempted) |
| Duplicate customer helpers | `src/lib/mlP1S1DuplicateCustomer.js` + service import restored |
| Identity / address_line_1 policy | `src/lib/mlP1S1Identity.js` |
| Tenant deny-by-default | `src/lib/mlP1S1Tenant.js` — **session required**; URL match only; no default fallback; null row tenant DENY |
| Audit event builder | `src/lib/mlP1S1AuditEvents.js` — generates `event_id` + `timestamp` |
| KPI store | `src/lib/mlP1S1Kpi.js` |
| Draft quote service (`quotes` only) | `src/services/mlP1S1QuoteDraftService.js` — in-flight idempotency lock + notes marker |
| Mobile-first UI | `src/pages/crm/MlP1S1DraftQuotePage.jsx` |
| Routes | `App.jsx` → `estimates/new` + `estimates/p1-draft` → S1 page; `estimates/:id` remains ProposalBuilder |
| Unit tests | `tests/unit/ml-p1-s1-foundation.test.mjs` (`npm run test:ml-p1-s1-helpers`) |

## Explicit non-delivery (authorized stop)

- Quote issue / approve / reject / expire / revise  
- Accept → job  
- Job execution  
- Invoice  
- Live payment  
- send-estimate  
- Schema migrations  

## Residual (honest — not closed in this PR)

| Residual | Status |
| --- | --- |
| Server/RLS DENY on `estimates` INSERT | **Deferred** — requires separately authorized additive migration; app DENY removes create insert path in modal |
| DB unique constraint on draft idempotency key | **Deferred** — process-local inflight lock + notes marker; cross-process race needs migration |
| Role matrix enforcement for draft create | **Documented gap** — `actorRole` recorded as `office`; CRM auth assumed; server role check not in S1 |
| G-03 live RLS negatives | Helper unit tests only |

## KI mapping progress

| KI | Status in S1 |
| --- | --- |
| KI-01 dual estimates | App DENY + no insert; server RLS residual |
| KI-02 identity | Lead authoritative; service address on lead; dup check wired |
| KI-03 UUID/bigint | Documented defer; no name linking |
| KI-04 address fields | address_line_1 / address1 alias via intake |
| KI-05/08 tenant | Session-required resolveWriteTenantId + mismatch/null DENY |
| KI-12 audit | draft_created with event_id + emit attempt |
| KI-13/14 | idempotent draft + inflight lock; Notes-escape diary hooks |
| KI-15 | Single draft path for new estimates/new |

## Tests run

```bash
cd command-center && npm run test:ml-p1-s1-helpers
```

## Merge note

Implementation PR merge requires **later Founder authorization at exact reviewed head SHA**.
