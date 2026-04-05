# 02_inventory_edge_functions.md

## Supabase service-role client
- `supabase/functions/_lib/supabaseAdmin.ts:1-11` defines the privileged `supabaseAdmin` client and requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` environment variables before any edge function executes.

## Shared helpers
- `supabase/functions/_shared/publicUtils.ts:6-62` centralizes CORS, rate limits, and `logPublicEvent` that writes to `public.public_events`.
- `supabase/functions/_shared/taskUtils.ts:1-26` exports `closeFollowUpTasks` used by quote/invoice flows.

## Edge function catalog (Money Loop surface)

| Edge Function | Route | Purpose / automation | Tables touched & side effects | Reference |
|---------------|-------|----------------------|-------------------------------|-----------|
| `public-quote` | `functions/v1/public-quote` | Validates tokens, returns quotes + line items, logs `public_quote_view`, enforces rate limits and origin allow list | `quotes`, `quote_items`, leads (via embedded select), `public_events`; reads `public_token` and writes view events  | `supabase/functions/public-quote/index.ts:29-118` |
| `public-invoice` | `functions/v1/public-invoice` | Token-based invoice lookup, surfaces details/line items, logs `public_invoice_view` for public events | `invoices`, `invoice_items`, leads, `public_events`; uses `public_token`  | `supabase/functions/public-invoice/index.ts:29-122` |
| `public-pay` | `functions/v1/public-pay` | Accepts payment requests, calls RPC `process_public_payment`, updates invoice paid fields, inserts `transactions`, logs `public_pay` event, handles rate limiting | `invoices`, `transactions`, `public_events`, RPC `process_public_payment` | `supabase/functions/public-pay/index.ts:86-188` |
| `public-quote-approve` | `functions/v1/public-quote-approve` | Marks quotes as accepted/declined, sets timestamps, writes `public_quote_approve` events, and marks follow-up tasks as completed | `quotes`, `crm_tasks`, `public_events` | `supabase/functions/public-quote-approve/index.ts:29-176` |
| `quote-update-status` | `functions/v1/quote-update-status` | Allows authenticated updates to quote statuses, stamps `accepted_at`/`rejected_at`, closes follow-up tasks | `quotes`, `crm_tasks` | `supabase/functions/quote-update-status/index.ts:19-79` |
| `invoice-update-status` | `functions/v1/invoice-update-status` | Authenticated invoice status changes; when paid, also closes follow-up tasks | `invoices`, `crm_tasks` | `supabase/functions/invoice-update-status/index.ts:19-74` |
| `lead-update-stage` | `functions/v1/lead-update-stage` | Updates lead status and timestamps, emits `kanban_status_events`, closes follow-up tasks | `leads`, `crm_tasks`, `kanban_status_events` | `supabase/functions/lead-update-stage/index.ts:38-120`, `supabase/functions/_shared/taskUtils.ts:1-26` |
| `kanban-list` & `kanban-move` | `functions/v1/kanban-list`, `functions/v1/kanban-move` | Drive the money-focused board (job scheduling, status transitions); insert `kanban_status_events` and close tasks when quotes/jobs move | `jobs`, `quotes`, `kanban_status_events`, `crm_tasks` | `supabase/functions/kanban-list/index.ts:1-86`, `supabase/functions/kanban-move/index.ts:1-640` |

Additional edge functions such as `quote-update-status`, `invoice-update-status`, and `lead-update-stage` all rely on the shared helpers for CORS/auth (see `_shared/publicUtils.ts`) and directly update the Money Loop tables listed above.
