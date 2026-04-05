# A-EXEC-1 Stop Gate A-1 Verification (Local)

Date: 2026-02-16
Environment: local Supabase (command-center)

## 0) Snapshot sanity (row counts)
```
automation_suspensions: 0
crm_tasks: 6
events: 3
invoice_items: 0
invoices: 3
jobs: 0
leads: 3
quote_items: 0
quotes: 3
```

## 1) A-DB-01 events table
- Columns and defaults present: id, tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload, created_at.

## 2) A-DB-02 automation_suspensions table
- Columns and defaults present.
- Unique partial indexes exist to enforce one active suspension per entity.

## 3) A-DB-03 jobs UNSCHEDULED
- Insert test succeeded (transaction + rollback): status accepts UNSCHEDULED.
- No status check constraint present; status stored as text.

## 4) A-DB-04 line_items JSONB
- Columns exist on quotes/invoices with JSONB defaults.
- Array check constraints present: quotes_line_items_is_array, invoices_line_items_is_array.
- Array behavior verified by insert tests.
- Negative test failed as expected:
```
ERROR: new row for relation "quotes" violates check constraint "quotes_line_items_is_array"
```

## 5) A-DB-05 manual convert fields
- contacts.is_customer, contacts.customer_created_at, contacts.manual_convert_reason exist.

## 6) tenant_id presence
- tenant_id present on: leads, quotes, quote_items, jobs, invoices, invoice_items, crm_tasks, events, automation_suspensions.

## Result
Stop Gate A-1 verification passed (local).

## Notes
- `last_human_signal_at` was NOT part of A-EXEC-1 scope (verified correctly absent).
- This field was added in A-EXEC-2 migration (20260216_02) to support lead-level human signal tracking required by hardening gaps #1 and #4.
