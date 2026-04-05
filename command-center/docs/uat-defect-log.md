# UAT Defect Log

## Rules
- Log defects only. Do not mix enhancements into the defect list.
- Every defect must include environment, severity, current status, and evidence.
- Use `LOCAL-UAT` for workflow logic and `LIVE-UAT` for deployed behavior.

## Severity
- `Blocker`: Stops the core revenue path or creates direct money-loss risk.
- `Major`: Flow still works, but creates operational risk or unreliable behavior.
- `Minor`: Non-fatal defect or rough edge.
- `Enhancement`: Idea only. Keep out of this log.

## Status
- `Open`
- `In Progress`
- `Blocked`
- `Resolved`
- `Deferred`

## Open

## In Progress

## Blocked

## Deferred

## Resolved

### UAT-003 | LOCAL-UAT | Work Order Scheduling Persistence
- Severity: Blocker
- Status: Resolved
- Resolution: Scheduling now updates work orders through the service-role `work-order-update` path, and the status transition to `scheduled` persists correctly through reload and downstream workflow steps.
- Evidence: [uat-local-work-order.spec.js](/c:/BHFOS/command-center/tests/smoke/uat-local-work-order.spec.js)

### UAT-006 | LIVE-UAT | Public Payment Link
- Severity: Blocker
- Status: Resolved
- Resolution: Live payment links now load the correct invoice, hand off to hosted Stripe Checkout, reconcile `payment_intent.succeeded` through `payment-webhook`, flip invoices to `paid`, and mark the lead `paid` after the final invoice clears. The live fixes were:
  1. repair `public.trg_money_loop_invoice_followups()` for invoice rows that cannot safely assume `NEW.lead_id`
  2. repair `public.enqueue_quickbooks_sync()` so the shared trigger works for both `invoices` and `leads`
  3. remove invalid `leads.updated_at` writes from the Stripe webhook and direct public-pay success path
  4. close invoice follow-up tasks on webhook reconciliation
- Evidence: [payment-webhook/index.ts](/c:/BHFOS/command-center/supabase/functions/payment-webhook/index.ts), [public-pay/index.ts](/c:/BHFOS/command-center/supabase/functions/public-pay/index.ts), [20260313225500_fix_invoice_followups_missing_lead_id.sql](/c:/BHFOS/command-center/supabase/migrations/20260313225500_fix_invoice_followups_missing_lead_id.sql), [20260313233000_fix_enqueue_quickbooks_sync_polymorphic.sql](/c:/BHFOS/command-center/supabase/migrations/20260313233000_fix_enqueue_quickbooks_sync_polymorphic.sql), [prove-a-exec-2-staging.mjs](/c:/BHFOS/command-center/scripts/prove-a-exec-2-staging.mjs)
- Notes: The latest live proof run `aexec2stg_0b104168` passed the public payment gate end to end. A separate Appendix A issue remains around duplicate `JobCreated` event emission, but it is no longer blocking `UAT-006`.

## Entry Template
### UAT-000 | ENVIRONMENT | AREA
- Severity:
- Status:
- Summary:
- Precondition:
- Steps:
  1.
  2.
  3.
- Expected:
- Actual:
- Evidence:
- Notes:
