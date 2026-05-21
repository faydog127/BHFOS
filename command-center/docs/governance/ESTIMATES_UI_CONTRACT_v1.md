# Estimates UI — Contract (v1)

Purpose: define what **must** be true for the Estimates UI so it is consistent, legible on desktop, and traceable across connected records.

This contract is intentionally narrow (v1) and is written to be enforced via UI contract tests.

Dependencies:
- `docs/governance/CRM_UI_SYSTEM_CONTRACT_v1.md`

## 1) Naming / terminology (locked)

In the CRM UI:
- list views must say **Estimates**
- detail views must say **Estimate #<id>**
- any “Quote” labeling is prohibited (v1), unless explicitly marked legacy + read-only.

If the underlying database/table uses `quote` terminology, the UI must still present **Estimate**.

## 2) Desktop layout (v1 minimum)

On desktop:
- the Estimate editor must use a multi-column layout when space allows
- totals + primary actions must remain easy to find without excessive scrolling

Minimum structure (v1):
- header: identifier + status + primary actions
- left: customer/service info + line items editor + terms/notes
- right: summary totals + delivery history + traceability links

## 3) Price book UX (information density)

Problem statement (v1):
- price book rows are currently too “thin” to support fast selection and confidence.

v1 requirement:
- each selectable price book item must render at least:
  - name
  - code (if present)
  - price
  - **2–3 lines of description** (or a safe, deliberate truncation with “expand”)

Non-goal (v1):
- perfect taxonomy. We need better rows before better categories.

## 4) Line items hierarchy (legibility)

Line items must be visually grouped and scannable.

Minimum (v1):
- clear separation between:
  - services / labor
  - materials
  - discounts / promotions
  - taxes / fees (if used)
- a visible subtotal prior to discounts/tax and a final total

## 5) Discounts (manual input required)

v1 requirement:
- the user must be able to apply manual discounts without developer intervention.

Minimum (v1) discount types:
- fixed amount (e.g. `$50 off`)
- percentage (e.g. `10% off`)

Minimum UI behavior:
- discount must update totals immediately
- discount must be represented as an explicit line item (not hidden math)

## 6) Terms & notes (major overhaul, v1 scope)

v1 requirement:
- separate “Customer-visible” vs “Internal” text
- provide a clean, readable editor experience (not a cramped textarea)
- ensure the customer-visible content is what appears in preview/PDF/send flows

Versioning invariant (v1):
- once an estimate is sent, the exact sent snapshot must remain viewable (auditability).

## 7) Traceability links (required)

If connected record IDs exist, they must be visible and clickable:
- Work Order ID
- Invoice ID
- Payment/Receipt ID

Walking back must be possible:
- Payment/Receipt → Invoice → Work Order → Estimate

## 8) Contract test targets (v1)

The following must be verifiable by automated UI checks (Playwright or equivalent):
- page title contains “Estimate”, not “Quote”
- primary content expands on desktop viewport (not boxed-in)
- price book rows show descriptions
- discounts change totals and appear as explicit line items
- connected IDs are clickable links when present

