# CRM ← HCP Pricebook Import — Closeout

| Field | Value |
| --- | --- |
| Disposition | **CRM_HCP_PRICEBOOK_IMPORT_PASS** |
| Applied | 2026-07-22 |
| Branch | `ops/hcp-crm-pricebook-import` |
| Founder answers | `CRM_HCP_PRICEBOOK_FOUNDER_ANSWERS_2026-07-22.md` |
| CSV SHA-256 | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| XLSX SHA-256 | `2A5E47BFDABDBF416883F234A4F3E04EB85715E75588570C32860AFC993A46B9` |

## What ran

1. **PD-PB-04 schema** — additive columns on `public.price_book`: `taxable`, `online_booking_enabled`, `subcategory`, `industry`, `unit_of_measure` (`20260722150000_ml_p1_price_book_hcp_fields.sql`).
2. **Import** — exact **52** HCP CSV rows upserted (`code` = task code; prices unchanged).
3. **Deactivate** — **43** legacy codes turned off for new quotes (Hold + overlaps + clear HCP replacements). **No deletes.**
4. **Retain** — `DISC-MIL-10PCT` remains active.

## Verification

| Check | Result |
| --- | --- |
| HCP↔CRM name/price/tax/booking/unit mismatches | **0** |
| HCP codes present & active | **52 / 52** |
| `DISC-050` active at −$50 | **yes** |
| `BUNDLE-DISCOUNT-50` inactive | **yes** |
| `DISC-MIL-10PCT` active | **yes** |
| Quote items count | **119** (unchanged) |
| Invoice items count | **11** (unchanged) |
| Catalog rows | **47 → 99** (legacy kept + 52 HCP) |
| Active rows | **44 → 53** (52 HCP + military discount) |

Evidence: `command-center/tmp/hcp-pricebook/VERIFY_REPORT.json`, `APPLY_PLAN.json`, `live_price_book_pre_import.json`.

## Active catalog (new quotes)

52 HCP services/discounts **plus** CRM-only `DISC-MIL-10PCT`. Legacy replaced codes remain in the table as inactive for history.

## Not in this change

- No UI redesign
- No historical quote/job/invoice rewrite
- No multi-company / tenant architecture
- Migration applied via linked `db query -f` (same pattern as Slice 4); repo file ready for PR

## Re-apply policy (post-closeout)

- Prod import for CSV SHA `FB3C4128…` is **complete**. Do not re-run `hcp-pricebook-apply.mjs --execute` for this SHA.
- Tooling now refuses same-SHA re-apply unless `--allow-reapply` plus a full mutation gate (`--environment=production --authorization=<new Category C ref> --sha=<hex> --i-understand-production`) and a pre-import backup file.
- Merging the source PR syncs repo only; it is not authorization to mutate the catalog again.
