# ML-P1 Price-Book Import — Evidence Manifest

| Field | Value |
| --- | --- |
| Disposition | `CRM_HCP_PRICEBOOK_IMPORT_PASS` |
| Gate | A3 data applied; A2 source PR to follow |
| Base SHA | `3bb175e3a952756066b29dc38ab25864ad47bdca` |
| HCP CSV SHA-256 | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| HCP XLSX SHA-256 | `2A5E47BFDABDBF416883F234A4F3E04EB85715E75588570C32860AFC993A46B9` |

## Artifacts

| Path | Role |
| --- | --- |
| `docs/governance/decisions/CRM_HCP_PRICEBOOK_FOUNDER_ANSWERS_2026-07-22.md` | Locked PD-PB-01…04 |
| `docs/governance/decisions/CRM_HCP_PRICEBOOK_IMPORT_CLOSEOUT.md` | Closeout |
| `docs/governance/decisions/CRM_HCP_PRICEBOOK_UPDATE_DECISION_PACKET.md` | Pre-import dry-run packet |
| `docs/governance/decisions/CRM_HCP_PRICEBOOK_FOUNDER_DECISIONS_PD_PB_01_04.md` | Founder decision packet |
| `supabase/migrations/20260722150000_ml_p1_price_book_hcp_fields.sql` | Additive catalog fields |
| `tools/hcp-pricebook-*.mjs` | Verify / dry-run / apply / verify-import |
| `tmp/hcp-pricebook/VERIFY_REPORT.json` | Local verify evidence (gitignored tmp) |

## Prod checks (post-apply)

- 52 HCP codes present & active; 0 name/price/tax/booking mismatches
- `DISC-050` active (−$50); `BUNDLE-DISCOUNT-50` inactive
- `DISC-MIL-10PCT` retained active
- Quote items 119 / invoice items 11 unchanged
- Catalog 47 → 99 rows; 53 active (52 HCP + military)

## Residuals

| ID | Note |
| --- | --- |
| R-PB-01 | Repo source lag vs prod until this PR merges |
| R-S4-07 | Soft tenant_id stamps (pre-existing, non-blocking) |
