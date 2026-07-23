# Decision Packet ? HCP ? BHFOS CRM Pricebook Update

| Field | Value |
| --- | --- |
| Disposition | **CRM_PRICEBOOK_UPDATE_REQUIRES_PRODUCT_DECISION** |
| Authority | Founder auth 2026-07-22 (HCP is authoritative; uploaded files = mirror) |
| Mutation | **NOT STARTED** (stopped at dry-run) |
| CSV SHA-256 | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| XLSX SHA-256 | `2A5E47BFDABDBF416883F234A4F3E04EB85715E75588570C32860AFC993A46B9` |
| Live `price_book` backup | `command-center/tmp/hcp-pricebook/live_price_book.json` (47 rows) |
| Dry-run artifact | `command-center/tmp/hcp-pricebook/DRY_RUN_RECONCILIATION.json` |

## Discovery (pre-mutation)

| Area | Finding |
| --- | --- |
| Canonical table | `public.price_book` (`code` = business/SKU id; map from HCP `task_code`) |
| Live catalog | 47 rows, tenant sentinel `default` only (nullable column; **not used for auth**) |
| Writers today | Admin UI direct table writes; **no HCP sync**; no dedicated import RPC yet |
| CRM admin routes | Pricebook manager routes currently commented out in `App.jsx` |
| Quote/job money path | `quotes` / `quote_items` (estimates INSERT denied) ? untouched |
| Schema gaps vs HCP | Missing: `taxable`, `online_booking_enabled`, `subcategory_1/2`, `industry` (bounded additive columns planned if import proceeds) |

## Dry-run reconciliation (by task code)

| Bucket | Count |
| --- | --- |
| HCP Import Draft rows | 52 |
| Approved for import | **51** |
| Rejected | **1** (`DISC-050`, price `-50`) |
| Held sheet exclusions | 0 (none of Hold items appear in draft) |
| Exact code matches live | **0** |
| New HCP codes | **51** |
| Live codes absent from HCP | **47** |

**Interpretation:** HCP uses a **new task-code system** (e.g. `DV-100`). BHFOS still has the prior code system (`DV-STD`, `DUCT-*`, packages, etc.). This is a full catalog replacement by code, not an in-place price refresh.

## Material / policy stops

### 1) Negative price row ? `DISC-050`
HCP draft includes `DISC-050` at **`-50`**. Dry-run rejected it under ?invalid price.?  
If this is an intentional discount line, Founder must allow negative `base_price` (or map to `item_type=discount`).

### 2) Active legacy items that can double-charge with new HCP lines
Importing all 51 HCP codes **without** deactivating overlapping live actives would leave two sellable catalogs (material double-charge risk).

High-risk active absents (examples):

| Live code | Live name / price | Likely HCP successor |
| --- | --- | --- |
| `DV-STD` | Dryer Vent Safety Clean / $199 | `DV-100` ($159) |
| `DV-ROOF` | Roof Access / $99 | `DV-110` ($25) |
| `PKG-MIN` / `PKG-COMP` / `PKG-REST` | Legacy packages | New HCP package/service set |
| `MIN-VISIT` | Minimum Visit / $199 | Possibly covered by HCP core starting prices |
| `EXT-GUARD-STD` | Bird/Rodent Guard / $89 | Confirm successor in HCP draft |
| `DUCT-SYS2`, `DUCT-VENT`, `DUCT-RET` | Duct adders | New HCP air-duct adders |

Workbook `Current SQL Audit` already classifies many other absents as **HOLD ? recommend deactivate** (11 codes) and some as retain/consolidate ? those recommendations are recorded in the dry-run JSON.

## What will NOT be done without your answers

- No production `price_book` mutation
- No deactivation of live items
- No historical quote/job/invoice changes
- No Slice 5

## Decisions required (answer A/B/C style)

**PD-PB-01 ? `DISC-050` (-$50)**  
- **A)** Import as discount (allow negative / `item_type=discount`)  
- **B)** Exclude from CRM import  
- **C)** Other (specify)

**PD-PB-02 ? Active live codes absent from HCP (double-charge prevention)**  
- **A)** Auto-deactivate **all** active live codes not present in HCP Import Draft (retain rows; `active=false`) as part of this update  
- **B)** Auto-deactivate only those with workbook SQL Audit action HOLD/DEACTIV; leave the rest active for later  
- **C)** Deactivate the explicit high-risk overlap set only (list above + Founder edits); leave others active  
- **D)** Import HCP codes only; leave all live actives unchanged (accept dual-catalog risk ? not recommended)

**PD-PB-03 ? SQL Audit ?retain? / ?consolidate? absents**  
- **A)** Keep current dry-run recommendations (retain/consolidate lists unchanged; no deletes)  
- **B)** Provide alternate list

**PD-PB-04 ? Schema packing for taxable / online booking / subcategories**  
- **A)** Add nullable columns on `price_book` and fill from HCP (recommended)  
- **B)** Store only in description/notes (weaker; not recommended)

After PD-PB-01..04 are answered, Orchestrator may complete the **one-time** authorized import cycle (tooling ? backup ? import ? verify) and open a **source-sync** PR. That one-time prod apply for CSV SHA `FB3C4128?` completed 2026-07-22 (`CRM_HCP_PRICEBOOK_IMPORT_PASS`). **Repeat `--execute` / catalog re-apply requires new Category C Founder authorization.** Merging the source PR is separate Category C merge auth and does **not** re-authorize prod mutation.

## Explicit non-claims

No price optimization · no $2,000 aspiration repricing · no Slice 5 · no historical money mutation · no automatic deletes.

---

## Source-pair verification (2026-07-22 follow-up)

| File | Path | SHA-256 |
| --- | --- | --- |
| CSV | `C:\Users\erron\Downloads\The_Vent_Guys_HCP_Pricebook_Expanded.csv` | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| XLSX | `C:\Users\erron\Downloads\The_Vent_Guys_HCP_Pricebook_Expanded.xlsx` | `2A5E47BFDABDBF416883F234A4F3E04EB85715E75588570C32860AFC993A46B9` |

- CSV ? XLSX `HCP Import Draft`: **same approved version** (no material disagreement).
- Machine import source: **CSV**.
- Online Booking variants / `pricebook_template.csv`: **excluded**.
- Artifact: `tmp/hcp-pricebook/SOURCE_PAIR_VERIFICATION.json`.
- Mutation still blocked on **PD-PB-01?04** (unchanged).
