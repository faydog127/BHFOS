# Founder Decision Packet — CRM Pricebook Import (PD-PB-01…04)

| Field | Value |
| --- | --- |
| Status | **ANSWERED / APPLIED** — see `CRM_HCP_PRICEBOOK_FOUNDER_ANSWERS_2026-07-22.md` and `CRM_HCP_PRICEBOOK_IMPORT_CLOSEOUT.md` |
| HCP CSV SHA-256 | `FB3C412853619EBC54BE30627A9F133AAA962304B5A58F2D93833B086F9BB4B3` |
| HCP XLSX SHA-256 | `2A5E47BFDABDBF416883F234A4F3E04EB85715E75588570C32860AFC993A46B9` |
| Approved import rows | 52 (CSV = XLSX Import Draft; 0 disagreements; 0 held rows in import) |

**What this is asking:** Housecall Pro is the live pricebook. BHFOS must match it. Four business choices remain before we import.

---

## PD-PB-01 — Whole-Home Bundle Discount (`DISC-050`)

1. **Title:** How should the HCP “Whole-Home Bundle Discount” work in BHFOS?

2. **Item involved:** HCP task code **`DISC-050`** — *Whole-Home Bundle Discount*

3. **Current HCP value:** −$50 · not taxable · not online-bookable · description: apply when residential air-duct cleaning and dryer-vent cleaning are done on the **same visit** (do not stack with other discounts unless approved). This is a **discount / credit line**, not a sellable service.

4. **Current CRM value:** No `DISC-050` row. Closest existing line: **`BUNDLE-DISCOUNT-50`** (*Whole Home Bundle Discount*) at **−$50**, already active (used on ~4 quote lines historically).

5. **Why not automatic:** HCP uses a **new code** (`DISC-050`). CRM already has the same business idea under an **old code**. Importing both would show two identical −$50 discounts; skipping `DISC-050` leaves CRM out of sync with HCP’s official code.

6. **Recommended:** Import `DISC-050` as a **discount line** (negative amount allowed). **Deactivate** `BUNDLE-DISCOUNT-50` for new quotes (keep history).

7. **Other options:**  
   - Keep only `BUNDLE-DISCOUNT-50` and map/alias to HCP (weaker code match).  
   - Exclude discounts from CRM entirely and handle bundles manually (more office error).

8. **If retained (both active):** Staff can pick either discount → double-discount risk and confusion.

9. **If deactivated / consolidated:** Old quotes that used `BUNDLE-DISCOUNT-50` keep their stored −$50. New quotes use `DISC-050` only.

10. **Effects:** Quote/CO pickers show one bundle discount; online booking unchanged (flag is off); historical quotes/invoices unchanged.

11. **Reversible later?** Yes — reactivate old code or adjust discount setup without rewriting history.

12. **Founder question:** *Import HCP `DISC-050` as the only active whole-home bundle discount, and turn off `BUNDLE-DISCOUNT-50` for new work — Yes or No?*

---

## PD-PB-02 — Active CRM services missing from the HCP export

1. **Title:** What should we do with CRM services that are still “on” but **not** in today’s HCP pricebook?

2. **Condition:** 47 CRM codes are absent from the approved HCP import. We will **not delete** them. Choice is whether they stay **selectable for new quotes**.

3. **Current HCP value:** Those codes simply **do not exist** in the approved 52-row export (HCP has replaced many with new codes like `DV-100`, `AD-100`, etc.).

4. **Current CRM value (active items that need a clear call):**

**A. Already flagged “do not sell / hold” in the HCP workbook audit — recommend turn off for new quotes**

| Code | Name | Price | Why workbook says hold |
| --- | --- | --- | --- |
| BATH-FAN | Bathroom Fan Detail | $89 | Optional add-on; not core focus |
| BLOWER-RESTORE | Blower Motor Restoration | $499 | Higher-risk; scope not ready |
| CHECKUP-1YR | Annual Dryer Vent Safety Check | $149 | Below current $159 start; membership unclear |
| DUCT-FOG | Botanical Fogging | $149 | Overlaps odor; product unclear |
| DV-CABINET | Dryer Cabinet Deep Clean (Opened) | $149 | Needs SOP / insurance / authorization |
| HDW-ALARM | LintAlert System | $199 | Optional product; sourcing unclear |
| HDW-FIL-ES | Electrostatic Filter | $299 | Not in core launch |
| HDW-PCO-010 | Whole-Home PCO System | $1,499 | Not in core launch |
| HDW-UV-010 | UV-C Light System | $899 | Not in core launch |
| PKG-REALTOR-REFRESH | Package: Realtor Refresh | $599 | Package undefined |
| SANITIZER-BASIC | Antimicrobial Sanitizer | $149 | Product/claims policy undefined |

**B. Still active in CRM, missing from HCP, and overlapping a new HCP service (high confusion risk)**

| CRM code | CRM name / price | Seen on quotes* | HCP replacement |
| --- | --- | --- | --- |
| DV-STD | Dryer Vent Safety Clean / $199 | ~12 | **DV-100** $159 starting |
| DV-ROOF | Roof Access / $99 | ~1 | **DV-110** $25 standard roof |
| DUCT-SYS2 | Extra HVAC system (alt) / $399 | ~4 | Conflicts with **DUCT-SYS-ADD** / HCP **AD-110** |
| DUCT-VENT | Extra supply vent / $25 | ~9 | HCP **AD-120** $35 |
| DUCT-RET | Extra return / $45 | ~3 | HCP **AD-130** $75 |
| MIN-VISIT | Minimum Visit Charge / $199 | — | HCP starts service at DV-100 / AD-090 |
| EXT-GUARD-STD | Bird/Rodent Guard / $89 | — | Workbook says remove / replace with proper hood-cap |
| PKG-MIN / PKG-COMP / PKG-REST | Old packages $199–$526 | — | Workbook: reference-only, not billable lines |
| DISC-MIL-10PCT | Military Discount / $0 | ~2 | Not in HCP export — keep or redesign later |

\*Quote-line counts = how often that code appeared on quote lines (historical usage signal).

**C. Workbook says keep (will stay available unless you say otherwise)** — examples: attic/crawl/roof specialty access, coil clean, blower wheel, MagVent, transition upgrade, trip zone 2, etc. These are **not** blocked by this decision if you accept the recommended package below.

5. **Why not automatic:** Turning services off is a **sales policy** choice. Leaving them on next to HCP’s new codes risks charging the wrong (old) price.

6. **Recommended package:**  
   - **Turn off (deactivate for new quotes)** all of **A** and **B** above.  
   - **Keep** workbook “retain” access/restoration add-ons for now until a later tidy-up.  
   - **Do not delete** any row; history stays.

7. **Other options:** Turn off only A (hold list); leave B on (not recommended); turn off everything absent from HCP (more aggressive).

8. **If retained (left on):** Office can still sell $199 dryer vent (`DV-STD`) beside HCP’s $159 (`DV-100`) → wrong price / double-catalog.

9. **If deactivated:** Hidden from new quote pickers; old quotes/jobs/invoices keep their stored lines and prices.

10. **Effects:** New quotes/COs use HCP codes; online booking follows HCP flags on **new** items only; history untouched.

11. **Reversible?** Yes — reactivate any code later.

12. **Founder question:** *Deactivate the Hold list (A) and the overlapping old codes (B) for new quotes, without deleting history — Yes or No?*

---

## PD-PB-03 — Overlaps to consolidate

1. **Title:** Which duplicate CRM lines should fold into a single HCP service?

2. **Items involved (main consolidations):**

| Old CRM code(s) | What they are | Surviving HCP code | HCP price / name |
| --- | --- | --- | --- |
| DV-CLAMP ($15) + DV-SEAL ($29) | Separate clamp / seal “services” | **DV-220** | $49 *Reconnect and Seal Existing Transition* (materials stay internal) |
| DV-STD ($199) | Old core dryer vent | **DV-100** | $159 starting dryer vent clean |
| DV-ROOF ($99) | Old roof adder | **DV-110** | $25 standard roof access |
| DUCT-SYS2 ($399) vs DUCT-SYS-ADD ($449) | Two “extra system” codes | **AD-110** | HCP additional HVAC system (same visit) |
| DUCT-VENT ($25) / DUCT-RET ($45) | Extra openings | **AD-120** / **AD-130** | $35 supply / $75 return |
| BUNDLE-DISCOUNT-50 | Old bundle discount code | **DISC-050** | −$50 (see PD-PB-01) |

3. **Current HCP value:** One clear code per job of work (above).

4. **Current CRM value:** Multiple overlapping codes still active; some already used on quotes (see counts in PD-PB-02).

5. **Why not automatic:** Consolidation chooses a **winner code** and retires losers for new sales — that is a business call, not a math merge.

6. **Recommended:** Adopt the surviving HCP codes above; deactivate the old CRM codes for new work; **never rewrite** historical quote/invoice lines.

7. **Other options:** Keep old codes as aliases (more engineering); leave duplicates visible (not recommended).

8. **If retained:** Staff keep seeing two prices for the same work.

9. **If consolidated:** One picker choice going forward; history still shows whatever code was sold then.

10. **Effects:** Cleaner quotes/COs; booking uses HCP online-book flags on survivors; history unchanged.

11. **Reversible?** Partially — can reactivate old codes; cannot silently rewrite past documents.

12. **Founder question:** *Use the HCP survivor codes in the table and turn off the overlapping old CRM codes for new quotes — Yes or No?*

---

## PD-PB-04 — Smallest safe CRM field upgrades

1. **Title:** What extra information should CRM store so it can match HCP without changing prices?

2. **Condition:** HCP export carries fields CRM does not fully store today: tax yes/no, online booking yes/no, industry, subcategory, unit label. CRM already has name, description, category, price, and a service code field we will fill with HCP task codes.

3. **Current HCP value:** Those control fields are filled on all 52 approved rows.

4. **Current CRM value:** Price and name work; tax / online-booking / subcategory are missing or only guessed.

5. **Why not automatic:** Without a place to store “taxable” and “bookable online,” we either drop HCP settings (incomplete match) or stuff them into notes (hard to use, easy to break).

6. **Recommended (smallest safe design):** Add a few optional fields on the service catalog (no price changes):  
   - Taxable (yes/no)  
   - Online booking (yes/no)  
   - Subcategory (text)  
   - Industry (text)  
   - Unit of measure (text)  
   Keep using the existing service **code** for HCP task codes. Keep the existing internal company tag as-is; do **not** build multi-company logic.

7. **Other options:** Notes-only storage (weaker); skip tax/booking until a later project (HCP match incomplete).

8. **If we skip:** Prices can still import, but booking/tax behavior will not match HCP.

9. **If we add the small fields:** Import can match HCP settings; quotes keep using stored line prices as they do today.

10. **Effects:** Quote creation can respect taxable/bookable flags later; change orders still use stored prices; history untouched.

11. **Reversible?** Yes — unused fields can be ignored; no need to delete them.

12. **Founder question:** *Add the small optional fields (taxable, online booking, subcategory, industry, unit) so CRM can store HCP settings — Yes or No?*

---

## Copy/paste answer block

```text
PD-PB-01 (DISC-050 bundle discount):
[ ] A — Import DISC-050; deactivate BUNDLE-DISCOUNT-50 for new quotes (recommended)
[ ] B — Keep BUNDLE-DISCOUNT-50 only; do not import DISC-050
[ ] C — Other: ____________________

PD-PB-02 (active CRM items missing from HCP):
[ ] A — Deactivate Hold list (A) + overlapping old codes (B) for new quotes; keep history (recommended)
[ ] B — Deactivate Hold list (A) only; leave overlapping codes (B) active
[ ] C — Deactivate all CRM codes absent from HCP
[ ] D — Other: ____________________

PD-PB-03 (consolidation):
[ ] A — Use HCP survivor codes; deactivate overlapping old codes for new quotes (recommended)
[ ] B — Do not consolidate; leave overlaps active
[ ] C — Other: ____________________

PD-PB-04 (catalog fields):
[ ] A — Add small optional fields: taxable, online booking, subcategory, industry, unit (recommended)
[ ] B — Import prices/names/codes only; skip tax/booking/subcategory for now
[ ] C — Other: ____________________

Notes (optional):
```

After these answers, import proceeds under the existing pricebook authorization (backup → import → verify) without changing any approved HCP price.
