# ML-P1 State Ledger

| Field | Value |
| --- | --- |
| Updated | 2026-07-23 |
| Repo | https://github.com/faydog127/BHFOS |
| Worktree | `F:\Dev\BHFOS-ml-p1-s4` |
| Planning / code base (origin/main) | `3bb175e3a952756066b29dc38ab25864ad47bdca` |
| Active branch | `ops/hcp-crm-pricebook-import` @ `3f5b097f952970615f1835d2b83ac7b1427c18f0` |
| Persistent orchestrator prompt | Adopted 2026-07-23 (revised); obeys `FOUNDER_DELEGATED_AUTHORITY_POLICY.md` |
| Price-book PR | Draft https://github.com/faydog127/BHFOS/pull/100 |

## Slice / gate posture

| Slice | Gate | Status |
| --- | --- | --- |
| S1–S3 | Closed | Production coherent; residuals tracked separately |
| **S4** Field execution | **A3 complete** | `SLICE4_PRODUCTION_VALIDATION_PASS`; R-S4-06 remediated; soft residue R-S4-07 (tenant_id stamps) |
| Price-book (cross-cut) | **A2 draft PR #100**; prod already PASS | PD-PB-01…04 ratified; merge = Category C (Founder) after 3 review rounds + CI |
| **S5** Invoice generation | **Planning / PD open** | PR #99 docs; `SLICE5_PLANNING_REQUIRES_PRODUCT_DECISION` (PD-S5-01…07); **no A2 coding auth** |

## Production surfaces (known)

| Surface | Note |
| --- | --- |
| Supabase | `wwyxohjnyqnegzbxtuxs` |
| Prod UI | https://app.bhfos.com |
| Hostinger tip (last noted) | Still behind planning tip at S4 merge era — confirm before next UI deploy |
| Invoice-on-Complete | **OFF** until Slice 5 |

## Migrations applied (linked prod, relevant)

| Migration | Topic |
| --- | --- |
| `20260722120000`…`20260722130000` | S4 execution schema/RPCs/control amendment |
| `20260722140000` | R-S4-06 emit actor_id UUID |
| `20260722150000` | Price-book HCP fields (`taxable`, `online_booking_enabled`, `subcategory`, `industry`, `unit_of_measure`) — applied via `db query -f` |

## Price-book (PD-PB-01…04)

| Item | Value |
| --- | --- |
| HCP CSV SHA-256 | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| Import | 52 rows exact; no price changes |
| Active bundle discount | `DISC-050` only; `BUNDLE-DISCOUNT-50` deactivated for new quotes |
| CRM-only retain | `DISC-MIL-10PCT` still active |
| History | Quote/invoice line counts unchanged at import |
| Evidence | `ML-P1_PRICEBOOK_EVIDENCE_MANIFEST.md` |

## Outstanding residuals / blockers

1. **R-PB-01** — Draft PR #100 needs 3 peer-review rounds + CI; **merge requires Founder** (Category C).
2. **S5 product decisions** — PD-S5-01…07 unanswered → coding blocked.
3. **R-S4-07** — Soft: row `tenant_id` stamps (non-blocking).
4. **Stale open docs PRs** — #94, #87, #86, #85 may need close/supercede hygiene (non-blocking).

## Standing policies in force

- Auto-continue inside granted slice scope per Founder prompt + `FOUNDER_DELEGATED_AUTHORITY_POLICY.md`.
- Draft PR / review coordination = standing (A/B). Merge / new prod mutation / next slice = Category C.
- Synthetic-only production validation; cleanup required.
- S4 CO / make-safe / status vocabulary / invoice-on-complete OFF (ratified 2026-07-22).
- Three peer-review rounds before any PR merges to `main`.

## Next authorised moves

| Move | Gate | Auth |
| --- | --- | --- |
| Complete 3 peer-review rounds on PR #100 | A2 | Standing (review coordination) |
| Mark ready + merge PR #100 | A2→main | **Founder** (Category C) |
| Do **not** start S5 coding / Stripe / invoice / TIS / G2.3 | — | Stop condition |
