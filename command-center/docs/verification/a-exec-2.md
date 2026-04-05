# A-EXEC-2 Verification Results

Date: 2026-02-16
Environment: Local Supabase (`command-center`)

## Status

**Stop Gate A-2: PASSED (runtime proven locally).**

This was originally blocked by runtime wiring issues (not by business logic). The gate is now validated by executing endpoints and signed webhook flows end-to-end.

## What Was Broken

1. Local runtime was treated as failing with `503`, but the actual issue was service orchestration/test wiring (functions were not consistently served in the same verification run).
2. Webhook signature validation always failed in Deno because code used Stripe sync verification (`constructEvent`) instead of async (`constructEventAsync`).
3. Payment events used Stripe IDs (`pi_...` / `evt_...`) as `events.entity_id`, but `events.entity_id` is `uuid`. Those inserts silently failed.
4. Runtime harness did not force `payments_mode = 'stripe'`, so `public-pay` fell back to blocked/RPC paths and did not return `payment_intent_id`.
5. Signed webhook test initially hashed one JSON body and sent a different one, invalidating signatures.

## Fixes Applied

- `supabase/functions/payment-webhook/index.ts`
  - switched to `await stripe.webhooks.constructEventAsync(...)`
  - keeps DB-level idempotency via `stripe_webhook_events` insert-first
  - payment events now use UUID-backed entity IDs (`invoice.id`) for `events`
  - unsupported/reversal webhook types no longer attempt invalid UUID event inserts
- `supabase/functions/public-pay/index.ts`
  - `PaymentInitiated` event identity changed to UUID-backed invoice ID
  - payload still carries Stripe `payment_intent_id`
- `supabase/functions/manual-convert-customer/index.ts`
  - preserves `customer_created_at` if already set
- `scripts/prove-a-exec-2-runtime.ps1`
  - added deterministic runtime proof harness
  - sets `payments_mode = 'stripe'` for test run
  - uses raw-body signed webhook posts
  - verifies dedupe, installment logic, task-spam controls, and quote-accept idempotency

## Runtime Proof Executed

Command:

```powershell
pwsh -NoProfile -File c:\BHFOS\command-center\scripts\prove-a-exec-2-runtime.ps1
```

Result: **PASS**

Run ID: `aexec2rt_cf069fa4`

Verified in one run:

1. Endpoint smoke:
   - `public-quote` returns `200`
   - `public-invoice` returns `200`
   - `public-quote-approve` burst returns `200`
   - `public-pay` initiate returns `payment_intent_id`
2. Signed webhook success + resend dedupe:
   - webhook success accepted (`200`)
   - resend accepted (`200`) and deduped (`stripe_webhook_events` remains one row per `event_id`)
   - `PaymentSucceeded` / `InvoicePaid` not duplicated on resend
   - receipt task not duplicated on resend
3. Installment logic:
   - after paying invoice #1 only: lead is **not** `paid`
   - after paying invoice #2: lead becomes `paid`
4. Task spam guard:
   - 10x quote refresh does not spam follow-up tasks
5. Quote accept idempotency:
   - exactly one job for quote
   - exactly one `JobCreated` event
   - exactly one `Schedule Job` task

## Notes

- This is a local runtime proof with valid signed webhook payloads using the configured webhook secret.
- If you also want external transport proof (Stripe CLI forward/resend over network path), run that as a separate staging check.
- Route compatibility was fixed: both `/functions/v1/payment-webhook` and `/functions/v1/stripe-webhook` now resolve to the same handler.
