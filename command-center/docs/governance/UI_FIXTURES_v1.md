# UI Fixtures (v1)

Purpose: define a small set of canonical scenarios (“fixtures”) used to validate the CRM UI contracts.

Fixtures are not just mock data; they are **workflow narratives** that specify what the UI must show and what must be clickable/traceable.

Dependencies:
- `docs/governance/CRM_UI_SYSTEM_CONTRACT_v1.md`
- `docs/governance/ESTIMATES_UI_CONTRACT_v1.md`
- `docs/governance/MONEY_UI_CONTRACT_v1.md`

## Fixture F1 — Simple service estimate (no discount)

Scenario:
- Customer requests a single service (e.g., “Dryer Vent Safety Clean”).
- One visit, one line item, no discounts.

Must be true:
- Estimate detail page title uses “Estimate”, not “Quote”.
- Line items section is legible and scannable.
- Summary total matches the single line item total.

## Fixture F2 — Multi-line estimate with optional add-ons

Scenario:
- Core service + 2 add-on items.
- Optional item toggled on/off changes total.

Must be true:
- Add-ons are visually distinct (grouping/hierarchy).
- Total updates immediately and predictably.

## Fixture F3 — Manual discount (fixed + percent)

Scenario:
- User applies a $ amount discount.
- User applies a % discount (separate run, separate estimate).

Must be true:
- Discount is represented as an explicit line item.
- Discount updates subtotal/total immediately.
- Discount is persisted and appears in preview/PDF/send artifacts.

## Fixture F4 — Terms & notes snapshot after send

Scenario:
- User edits customer-visible terms and internal notes.
- User sends the estimate.
- Later, user edits terms again.

Must be true:
- Customer-visible terms are what appears in send/preview/PDF.
- The “sent snapshot” remains viewable and unchanged (auditability).

## Fixture F5 — Full traceability graph (end-to-end)

Scenario:
- Estimate is approved → Work Order created → Invoice issued → Payment received (receipt/tracking id).

Must be true:
- Receipt/Payment page links to Invoice.
- Invoice page links to Work Order and Estimate.
- Work Order page links to Estimate (and Invoice if present).
- Every ID shown is clickable and navigates to the correct detail view.

## Fixture F6 — Job cost attribution (subcontractor)

Scenario:
- Work Order includes a subcontracted HVAC expense.

Must be true:
- Work Order shows a “Costs” section with the subcontractor entry.
- “Money” view rolls up job spend and shows directional margin for the job.

