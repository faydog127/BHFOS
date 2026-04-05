# EV-2026-03-18 Money Loop Smoke

Status: CAPTURED (local)
Owner: QA / Founder

## Scope

Quote -> Invoice -> Payment -> Close

## Raw Artifacts

- Local run (2026-04-04): `tmp/money-loop-smoke-test_latest.log`

## Result

- PASS (local)
- Run ID: `smoke-20260404_114824`
- Tenant: `tvg`
- Quote:
  - `quote_id=3566dcdb-a482-4f49-8a3c-0d3fd5e0aa99`
  - `quote_token=3d5e4560-3572-4852-92e1-add592f63c7f`
- Job:
  - `job_id=13df892c-6b49-438e-8b88-8ed65d746f34` (created exactly once for quote)
- Invoice:
  - `invoice_id=5914c624-7b4e-40c7-9338-41cf3c162abd`
  - `invoice_token=18e79087-f97c-42f7-b396-5e92396dff46`
- Payment:
  - `public-pay #1` returned `HTTP 200` and invoice row shows `status=paid`, `amount_paid=100`, `balance_due=0`
  - `public-pay #2` returned `already_paid=true` (idempotency behavior)
- Post-conditions asserted by script:
  - `leads.status = paid`
  - invoice follow-up tasks closed (`open_invoice_tasks=0`)
  - at least one `ReceiptSent` event exists
