# 03_inventory_ui_money_loop.md

## CRM (internal) surfaces

- **`src/pages/crm/QuoteBuilder.jsx`** (`:53-158`) – loads tenants/leads, edits line items stored in `quote_items`, auto-calculates totals, and inserts/deletes line item rows as part of the Money Loop flow.  
- **`src/pages/crm/InvoiceBuilder.jsx`** (`:71-233`) – pulls quotes (with `quote_items`), builds invoices with `invoice_items`, updates balance/line items, and fires `send-invoice` once the status flips to “sent.”  
- **`src/pages/crm/Jobs.jsx`** (`:43-130`) – surfaces scheduling actions, toggles job statuses (scheduled → in_progress → completed), and allows manual payment logging when jobs finish (funds recorded via `jobService.recordPayment`).

## Public / customer surfaces

- **`src/pages/public/QuoteView.jsx`** (`:73-210`) – hits `public-quote`/`public-quote-approve`, renders quote metadata + line items, and speaks the approval flow directly to `public-quote-approve`.  
- **`src/pages/public/InvoiceView.jsx`** (`:14-120`) – fetches invoices via Supabase (with `invoice_items`, lead, property/account joins) and links to `/pay/{public_token}` for payments.  
- **`src/pages/public/PaymentPage.jsx`** (`:26-154`) – loads `public-invoice`, posts to `public-pay`, and handles blocked/failed RPCs (touching `public_pay` events and `transactions` indirectly via `public-pay`).  

## Supporting services

- **`src/services/quoteService.js`** (`:1-100`) – converts estimates into quotes, inserts `quote_items`, and surfaces `quotes` updates for the CRM (used by QuoteBuilder).  
- **`src/services/paymentService.js`** (`:1-59`) – fetches invoices (with `invoice_items`), calls RPC `process_public_payment`, and reads/writes `transactions` for receipts and the Pay API.  
- **`src/services/emailService.js`** (`:7-210`) – creates follow-up tasks (`crm_tasks`) when document emails (including quotes/invoices) are sent, and uses business-day helper `getNextBusinessDayAtTen`.

These UI/services collectively cover the Money Loop’s lead → quote → job → invoice → payment journey documented in Appendix A.2.
