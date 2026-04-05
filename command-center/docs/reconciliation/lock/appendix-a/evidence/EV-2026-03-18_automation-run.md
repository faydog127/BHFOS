# EV-2026-03-18 Automation Run

Status: PARTIAL (local green, lock-stage proof pending)
Owner: QA / Backend

## Scope

Reminder ladder, delayed execution, business-hours handling across invoice, quote, and appointment reminder lanes

## Raw Artifacts

- Build:
  - `cd c:\BHFOS\command-center; npm run build`
- Local DB proof:
  - `Get-Content -Raw supabase\\migrations\\20260318193000_appendix_a_business_hours_and_invoice_ladder.sql | docker exec -i supabase_db_tvg-web-app psql -U postgres -d postgres`
  - `docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -c "select public.normalize_business_due_at('tvg', now()) as normalized_due_at;"`
  - `docker exec supabase_db_tvg-web-app psql -U postgres -d postgres -c "select count(*) as open_followups_missing_due_at from public.crm_tasks where type = 'follow_up' and status in ('open','new','pending','PENDING','in-progress') and due_at is null;"`
- End-to-end reminder proof:
  - `node .\\scripts\\appendix-a-automation-proof.mjs`
- Appointment reminder proof:
  - `node .\\scripts\\appointment-reminder-proof.mjs`
- Browser UAT:
  - `npx playwright test uat-local-appointments-reminders.spec.js --reporter=line`

## Observed Output

- Frontend build passed after backend automation changes.
- The new DB helper returned a normalized future business-window timestamp:
  - `2026-03-19 13:01:00+00`
- Backfill/normalization proof:
  - `open_followups_missing_due_at = 0`
- End-to-end reminder proof returned `ok: true` and demonstrated:
  - `send-invoice` created the invoice ladder and emitted `InvoiceSent`
  - Day 2 reminder sent successfully during business hours and emitted `InvoiceReminderSent`
  - paid invoice stopped the reminder path with `outcome = already_paid`
  - active suspension stopped the reminder path with `outcome = suppressed_active_suspension`
  - after-hours run deferred the Day 2 task to the next valid window with `outcome = deferred_after_hours`
  - `send-estimate` created a Day 2 quote reminder task and emitted `QuoteSent`
  - Day 2 quote reminder sent successfully during business hours and emitted `QuoteReminderSent`
  - public quote view created suspension and stopped the reminder path with `outcome = suppressed_active_suspension`
  - after-hours quote run deferred the Day 2 task to the next valid window with `outcome = deferred_after_hours`
- Proof summary from `appendix-a-automation-proof.mjs`:
  - `send_invoice.ladder_titles`:
    - `Invoice Unpaid - Follow Up`
    - `Invoice Reminder - Day 2`
    - `Invoice Follow Up - Day 5 Call`
    - `Invoice Escalation - Day 10`
  - `day2_send.outcome = sent`
  - `stop_on_paid.outcome = already_paid`
  - `suppression.outcome = suppressed_active_suspension`
  - `after_hours.outcome = deferred_after_hours`
  - `after_hours.after_due_at = 2026-03-19T13:01:00+00:00`
  - `quote_day2_send.outcome = sent`
  - `quote_suppression.outcome = suppressed_active_suspension`
  - `quote_after_hours.outcome = deferred_after_hours`
  - `quote_after_hours.after_due_at = 2026-03-19T13:01:00+00:00`
- Appointment reminder proof returned `ok: true` and demonstrated:
  - confirmed appointment creation queued both appointment reminder tasks
  - in-hours appointment reminder runner sent the due reminder and emitted `AppointmentReminderSent`
  - pending appointment confirmation queued reminders only after confirmation
  - cancelled appointment stopped follow-up work by closing the open reminder task
  - after-hours appointment reminder run deferred safely to the next valid business window
- Browser UAT passed for:
  - approving a pending appointment from `Schedule`
  - creating a confirmed appointment from `/tvg/crm/appointments`
  - reminder tasks persisting behind both UI flows

## Implementation Landed

- Shared backend business-hours authority:
  - `supabase/functions/_shared/businessHours.ts`
- Follow-up task normalization:
  - `supabase/functions/_shared/taskUtils.ts`
  - `supabase/migrations/20260318193000_appendix_a_business_hours_and_invoice_ladder.sql`
- Invoice ladder creation on send:
  - `supabase/functions/_shared/moneyLoopUtils.ts`
  - `supabase/functions/send-invoice/index.ts`
- Narrow Day-2 runner:
  - `supabase/functions/run-invoice-reminders/index.ts`
- Quote reminder scheduling on send:
  - `supabase/functions/_shared/moneyLoopUtils.ts`
  - `supabase/functions/send-estimate/index.ts`
- Narrow Day-2 quote runner:
  - `supabase/functions/run-quote-reminders/index.ts`
- Appointment reminder helpers:
  - `supabase/functions/_shared/appointmentUtils.ts`
- Appointment create/update backend:
  - `supabase/functions/create-appointment/index.ts`
  - `supabase/functions/update-appointment-status/index.ts`
- Appointment reminder runner:
  - `supabase/functions/run-appointment-reminders/index.ts`
- Appointment schema and business-settings surface:
  - `supabase/migrations/20260319103000_appendix_a_appointments_and_reminders.sql`
- Appointment frontend wiring:
  - `src/services/appointmentService.js`
  - `src/pages/crm/appointments/AppointmentScheduler.jsx`
  - `src/pages/crm/Schedule.jsx`
  - `src/components/appointments/AppointmentBooking.jsx`
  - `src/components/crm/appointments/BookingVerification.jsx`
- Repeatable proof harness:
  - `scripts/appendix-a-automation-proof.mjs`
  - `scripts/appointment-reminder-proof.mjs`

## Result

- `PARTIAL`
- Invoice, quote, and appointment reminder behavior are now locally proven end to end.
- Business-hours normalization is real in both TS and DB layers.
- Open follow-up tasks no longer rely on `NULL due_at`.
- Remaining gap before this area is fully green for A-LOCK:
  - this proof used isolated local migration application because the full local migration chain still contains unrelated older failures
  - non-local / lock-stage verification evidence is still separate work
  - manual founder/operator capture for the formal evidence pack is still separate work
