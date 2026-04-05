# 01_inventory_schema.md

## Source tables and policies captured by migrations

- **public.app_user_roles** (`supabase/migrations/20251210_create_core_tables.sql:4-24`)  
  Primary key + foreign key to `auth.users`, audit timestamp, and open/select policies for service and all-users roles.
- **public.global_config** (`supabase/migrations/20251210_create_core_tables.sql:26-45`)  
  Simple key/value store with RLS (select for everyone, full access only to service role) and seeded keys `system_status`/`maintenance_mode`.
- **public.public_events** (`supabase/migrations/20260109_public_tokens_and_events.sql:1-33`)  
  Audit table that stores hashed tokens, event kinds, tenant/quote/invoice links, IP/UA, status, metadata, and enables RLS for the service role.
- **public.crm_tasks** (extension only; columns/indexes added per `supabase/migrations/20260110_add_followup_tasks.sql:1-23`)  
  Adds tenant/source metadata, follow-up metadata jsonb, due dates, priority, and supporting indexes for tenant/due, source, and status lookups.

## Tables referenced in code but missing explicit DDL

| Table | Observed access | Missing migration evidence |
|-------|-----------------|-----------------------------|
| `quote_items` | `supabase/functions/public-quote/index.ts:64-91`, `src/pages/crm/QuoteBuilder.jsx:53-158`, `src/pages/crm/InvoiceBuilder.jsx:85-233` | `rg -n "quote_items" supabase/migrations` → **no CREATE TABLE found** (command returned no matches) |
| `invoice_items` | `supabase/functions/public-invoice/index.ts:61-97`, `supabase/functions/public-pay/index.ts:78-118`, `src/pages/crm/InvoiceBuilder.jsx:71-233`, `src/pages/public/InvoiceView.jsx:30-53` | `rg -n "invoice_items" supabase/migrations` → **no CREATE TABLE found** |
| `transactions` | Inserted by `supabase/functions/public-pay/index.ts:161-172` and queried by `src/services/paymentService.js:38-58` | `rg -n "create table public\\.transactions" supabase/migrations` → **no matches** |
| `quotes`, `invoices`, `jobs`, `leads` | Queried throughout services/UI (example `supabase/functions/public-quote/index.ts:64-91`, `src/pages/crm/InvoiceBuilder.jsx:71-233`, `src/pages/crm/Jobs.jsx:43-130`) | No `CREATE TABLE public.quotes/invoices/jobs/leads` in `supabase/migrations` (verified via `rg -n "CREATE TABLE public\\.(quotes|invoices|jobs|leads)" supabase/migrations` → empty) |

## Notes

- The schema inventory is therefore only partially captured inside this repo; key transactional tables live elsewhere (probably in the production Supabase project) but are referenced constantly by API/UI layers shown above.
