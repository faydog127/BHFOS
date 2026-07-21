# ML-P1 Slice 2 — Architecture Review

| Field | Value |
| --- | --- |
| Slice | ML-P1-S2 |
| Reviewer | _(Architecture — fill)_ |
| Verdict | **PENDING** |

## Boundaries

- Canonical writer: `mlP1S2QuoteLifecycleService` + S1 draft service for create/edit draft.
- Status model: Money-State statuses; DB may normalize `approved`→`accepted`.
- S2/S3 split: `auto_create_job_on_quote_acceptance` preserves accept recording without job product.
- Migration filename named: `20260721160000_ml_p1_s2_quote_lifecycle_rs102.sql` (R-S1-02 + gate; R-S1-03 is code matrix, no extra role table).

## Non-goals preserved

No Stripe, S6 follow-up, invoice product, R-S1-01 reopen, TIS/G2.3.

## Merge / deploy

Exact-head Founder auth required for merge. Deploy and prod migration apply require separate lines.
