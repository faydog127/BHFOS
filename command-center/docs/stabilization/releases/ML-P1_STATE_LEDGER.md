# ML-P1 State Ledger

| Field | Value |
| --- | --- |
| Updated | 2026-07-23 |
| Repo | https://github.com/faydog127/BHFOS |
| Worktree | `F:\Dev\BHFOS-ml-p1-s4` |
| Planning / code base (origin/main) | `3bb175e3a952756066b29dc38ab25864ad47bdca` |
| Active branch (local) | `ops/hcp-crm-pricebook-import` |
| Persistent orchestrator prompt | Adopted 2026-07-23 (revised); obeys `FOUNDER_DELEGATED_AUTHORITY_POLICY.md` |

## Slice / gate posture

| Slice | Gate | Status |
| --- | --- | --- |
| S1–S3 | Closed | Production coherent; residuals tracked separately |
| **S4** Field execution | **A3 complete** | `SLICE4_PRODUCTION_VALIDATION_PASS`; R-S4-06 remediated; soft residue R-S4-07 (tenant_id stamps) |
| Price-book (cross-cut) | **Prod applied; repo PR pending** | PD-PB-01…04 ratified; `CRM_HCP_PRICEBOOK_IMPORT_PASS` on linked DB |
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
| Repo residual | Migration + tools + decision docs **uncommitted**; no PR yet |

## Outstanding residuals / blockers

1. **Price-book source sync** — Prod catalog updated; branch artifacts not on `main` (needs A2 PR + 3-round peer review before merge).
2. **S5 product decisions** — PD-S5-01…07 unanswered → coding blocked.
3. **R-S4-07** — Soft: row `tenant_id` stamps (non-blocking).
4. **Stale open docs PRs** — #94, #87, #86, #85 may need close/supercede hygiene (non-blocking).

## Standing policies in force

- Auto-continue when packet/policy authorises next intra-slice step and preconditions green.
- A0–A3 gate discipline; fail-closed on health/CI/permission errors.
- Synthetic-only production validation; cleanup required.
- S4 CO / make-safe / status vocabulary / invoice-on-complete OFF (ratified 2026-07-22).
- Three peer-review rounds (Product · Data · Security · Architecture · Financial Control) before any PR merges to `main`.

## Next authorised moves (no Founder re-ask if green)

| Move | Gate | Auth basis |
| --- | --- | --- |
| Commit + open PR for price-book migration/tools/docs | A2 | Close out ratified PD-PB import; peer review required before merge |
| Do **not** start S5 coding | — | Waiting PD-S5-01…07 |
| Do **not** enable invoice-on-complete | — | Slice 5 gate |
