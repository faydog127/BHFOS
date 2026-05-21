# UI Contract Tests (v1)

Purpose: define the minimum automated checks that enforce the UI contracts and prevent silent regressions.

This document is a test plan (v1). Implementation may use Playwright or equivalent.

Dependencies:
- `docs/governance/CRM_UI_SYSTEM_CONTRACT_v1.md`
- `docs/governance/ESTIMATES_UI_CONTRACT_v1.md`
- `docs/governance/MONEY_UI_CONTRACT_v1.md`
- `docs/governance/UI_FIXTURES_v1.md`

## 0) Test philosophy

- Prefer small, deterministic contract checks over broad end-to-end suites.
- Validate invariants that users notice:
  - language (“Estimate” vs “Quote”)
  - totals correctness after discount changes
  - clickable traceability links
  - layout density on desktop viewports

## 1) Contract checks (v1)

### CT1 — Vocabulary: “Estimate” is enforced

Target pages:
- Estimates list
- Estimate detail/editor

Assertions:
- page title/heading contains “Estimate”
- “Quote” does not appear in primary headings for Estimate pages

### CT2 — Desktop density: detail pages are not boxed-in

Viewport:
- 1440×900

Assertions:
- primary content container exceeds a minimum width threshold
- detail pages render multi-column layout when applicable

### CT3 — Price book rows include descriptions

Assertions:
- a price book row renders at least 2 lines of descriptive text, or an explicit expand control

### CT4 — Discounts are explicit and update totals

Assertions:
- applying a fixed discount creates a “Discount” line item
- total decreases by the expected amount
- applying a percent discount creates a “Discount” line item
- total decreases by the expected percentage (with defined rounding rules)

### CT5 — Traceability links exist when IDs exist

Assertions:
- when an invoice id exists, it is a clickable link
- when a work order id exists, it is a clickable link
- when a receipt/payment id exists, it is a clickable link

## 2) Fixtures required for CI (v1)

CI must have a stable way to load fixtures:
- either seeded test tenant data
- or mocked API responses at the UI layer (contract mode)

Non-goal (v1):
- running against production data.

