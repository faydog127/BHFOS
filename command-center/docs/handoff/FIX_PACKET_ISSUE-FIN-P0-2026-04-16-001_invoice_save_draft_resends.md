# Fix Packet — ISSUE-FIN-P0-2026-04-16-001 (Invoice “Save Draft” resend + totals mismatch)

## 1) Issue ID
- ID: ISSUE-FIN-P0-2026-04-16-001
- Links:
  - Founder report (screenshots): pending (attach golden sweep artifacts)

## 2) Title
- “Save Draft” must not send invoices; totals must remain consistent with edited line items

## 3) Severity
- P0 (revenue + customer comms integrity)

## 4) Environment
- Affected: PROD (email resent unexpectedly), LOCAL (used for reproduction)
- Target for fix + validation: LOCAL → PROD (controlled deploy window)

## 5) Layer(s)
- CRM Control (InvoiceBuilder UI + send behavior)
- Integrations (email via `send-invoice`)

## 6) Root cause
- “Save Draft” uses the current `invoice.status` to decide whether to call `send-invoice`.
- If an invoice is already `sent`, clicking “Save Draft” would unintentionally re-run `send-invoice` (and resend email/SMS).
- Totals mismatch report requires separate verification (see “Uncertainty”); it may be UI calculation vs stored fields vs line-item edits.

## 7) Evidence
- Runtime symptom:
  - Clicking “Save Draft” results in invoice emails being sent (unexpected).
  - User reports totals not adding up after editing amounts.
- Concrete example (PROD):
  - Invoice URL includes ID: `38164c8e-3bdb-457c-b46e-c86d1ced9a93`
  - Delivery History shows two “Invoice sent” events 1 minute apart (Apr 14, 2026 9:56 PM and 9:57 PM).
- Repo evidence:
  - `src/pages/crm/InvoiceBuilder.jsx` `handleSave()` invokes `send-invoice` when the save path decides status is `sent`.
- Notes on redaction (tokens/PII removed): YES (required for any screenshots / network logs)

## 8) Scope boundary
- IN SCOPE:
  - Prevent resend on “Save Draft” unless user explicitly chooses “Save & Send”.
  - Preserve existing “Save & Send” behavior.
  - Do not change invoice/payment architecture.
- OUT OF SCOPE:
  - Email template changes
  - Stripe/payment behavior changes
  - Work order logic changes

## 9) Exact files/functions/tables affected
- Files:
  - `src/pages/crm/InvoiceBuilder.jsx`
- Edge functions invoked (unchanged):
  - `supabase/functions/invoice-save/index.ts`
  - `supabase/functions/send-invoice/index.ts`

## 10) Proposed change
- Summary:
  - Only call `send-invoice` when the user explicitly clicks “Save & Send”.
  - “Save Draft” becomes “save only”, even if invoice status is already `sent`.
- Patch plan:
  1. Gate send behavior on the requested status (button intent), not the current invoice status.
  2. Show a clear toast when saving an already-sent invoice without resending.
  3. Validate that “Save & Send” still triggers send exactly once.
- Status:
  - Implemented in `src/pages/crm/InvoiceBuilder.jsx` (LOCAL patched; PROD deploy pending).

## 11) Risks
- Primary risk:
  - Operators may expect “Save Draft” to change status back to draft; it does not. It now saves without resending.
- Side effects:
  - None expected outside invoice sending behavior.

## 12) Validation steps
- LOCAL (UI):
  1. Open an invoice with status `sent`.
  2. Change a non-delivery field (e.g., terms) and click “Save Draft”.
  3. Confirm: no new delivery event is written; no send occurs.
  4. Click “Save & Send”.
  5. Confirm: exactly one send; delivery history records one event.
- PROD (controlled):
  - Repeat steps above on one low-risk internal invoice or during a low-activity window.

## 13) Rollback plan
- Code rollback:
  - Revert the `InvoiceBuilder.jsx` change and redeploy.
- Operational rollback:
  - If resend is mission-critical in the moment, use “Save & Send” explicitly while rollback is planned.

## 14) Status
- Current: Ready for Review / Deploy (PROD)
- Blockers:
  - Needs deploy (if not yet deployed to PROD).
- Next action:
  - Ship to PROD in a controlled window and re-run the operator “Invoice” golden path.

## 15) Owner
- Owner: Erron
- Reviewer: Erron
- Date opened: 2026-04-16
- Date closed:

---

## Remaining uncertainty (must verify)
- Totals mismatch:
  - Need exact repro steps + the invoice ID + what “changed the amount” means (line item edit vs credit vs work order total).
  - Capture: invoice items table view + summary + network response from `invoice-save` for the same save.
