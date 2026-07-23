# Founder Answers — CRM HCP Pricebook (PD-PB-01…04)

| Field | Value |
| --- | --- |
| Status | **LOCKED** — answers authorize schema + import under constraints below |
| Answered | 2026-07-22 |
| HCP CSV SHA-256 | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| HCP XLSX SHA-256 | `2A5E47BFDABDBF416883F234A4F3E04EB85715E75588570C32860AFC993A46B9` |
| Import rows | 52 exact HCP rows; **no price changes** |

## Decisions

### PD-PB-01 — A
Import `DISC-050`. Deactivate `BUNDLE-DISCOUNT-50` for new quotes. Preserve historical uses of the old code.

### PD-PB-02 — D (scoped)
- Deactivate workbook Hold list.
- Deactivate direct overlaps / clearly replaced or removed codes (including packages, `MIN-VISIT`, and functional HCP replacements).
- Retain `DISC-MIL-10PCT` as active CRM-only discount for now.
- Retain legitimate access/add-ons **not** duplicated by an HCP item.
- Never delete prior quote-line usage; preserve historical records.

### PD-PB-03 — A
Use HCP survivor codes; deactivate overlapping old CRM codes for new quotes. Do not rewrite historical quotes, jobs, change orders, or invoices.

Approved survivors:
- `DV-220` ← `DV-CLAMP`, `DV-SEAL`
- `DV-100` ← `DV-STD`
- `DV-110` ← `DV-ROOF`
- `AD-110` ← `DUCT-SYS2`, `DUCT-SYS-ADD`
- `AD-120` ← `DUCT-VENT`
- `AD-130` ← `DUCT-RET`
- `DISC-050` ← `BUNDLE-DISCOUNT-50`

### PD-PB-04 — A
Add optional catalog fields: `taxable`, `online_booking_enabled`, `subcategory`, `industry`, `unit_of_measure`.  
Continue using existing `code` for HCP task code. No tenant / multi-company architecture.

## Operating constraints
- HCP is pricing source of truth.
- Import approved 52 rows exactly.
- Do not change prices.
- Do not alter historical financial records.
- Do not delete legacy catalog records; deactivate only those approved above for new use.
