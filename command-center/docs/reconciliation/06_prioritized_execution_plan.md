# 06_prioritized_execution_plan.md

## Active Companion Plan
- See `docs/reconciliation/08_send_estimate_contract_gates_execution_plan.md` for the in-progress `send-estimate` contract-gates rollout plan, stop gates, and resume protocol if work pauses mid-implementation.

## P0 – Money-loop invariants that must land before the next charter refresh
1. **Add explicit `UNSCHEDULED` job state + scheduling workflow (Appendix A.2/A.7).**  
   - Update the jobs schema (migration or production DDL) to include `UNSCHEDULED` and any derived indexes referenced by `kanban` functions.  
   - Surface the status in `src/pages/crm/Jobs.jsx` (and any Kanban controls) so quote acceptance produces an `UNSCHEDULED` card that a user must explicitly move to `scheduled`.  
   - Ensure `kanban-move`/`kanban-list` (and/or new `job-schedule` function) respect the workflow (`UNSCHEDULED` → `SCHEDULED` → `COMPLETED`) and emit the events Appendix A.4 demands.
2. **Implement the invoice reminder ladder + business-hours guard (Appendix A.5 + A.6).**  
   - Introduce reminder scheduling logic (day 2 auto-safe, day 5 follow-up task, day 10 escalation) tied to invoice `sent_at` and `balance_due` (extend `emailService.js`/`supabase/functions/public-invoice` or a dedicated cron/Edge Function).  
   - Store `business_hours` (08:00-18:00 local) in `public.global_config` (add seeds or UI to edit) and wrap every outbound automation (quote/invoice reminders, invoice auto-messages, appointment reminders) so they run at or after 08:01 in that timezone, matching Appendix A.5’s “queue for next business window” rule.

## P1 – Important refinements that keep the system aligned
1. **Capture missing DDL for Money Loop tables.**  
   - Add migrations (or document production SQL) for `quotes`, `jobs`, `invoices`, `quote_items`, `invoice_items`, and `transactions`, referencing how the UI (`QuoteBuilder.jsx`, `InvoiceBuilder.jsx`, `public-pay`, etc.) manipulates them. This ensures the reconciliation docs can cite canonical schema.  
2. **Expand event logging to cover the Appendix A.4 taxonomy.**  
   - Either extend `public_events` or create a full `events` table with `event_type`, `actor_type`, and `payload`, and emit `HumanSignalReceived`, `AutomationSuspended`, and automation-triggered events from the share helpers used by `public-quote`, `public-invoice`, and CRM services.  
3. **Document edge function coverage vs. Appendix A.7.**  
   - Map the required functions (`lead_create`, `job_schedule`, `invoice_send`, etc.) to actual entry points, renaming or adding new wrappers where needed, so reviewers can see the chartered responsibilities reflected in `supabase/functions`.
