-- P0-02 — Event emission dedupe (money loop)
-- Goal: prevent duplicate canonical events under concurrency/replay while allowing multiple distinct payments.
--
-- Strategy: unique expression indexes keyed by the durable effect identifier.
-- - OfflinePaymentRecorded: dedupe by transaction_id
-- - PaymentSucceeded: dedupe by transaction_id
-- - InvoicePaid: dedupe by transaction_id
-- - PaymentInitiated: dedupe by checkout_session_id (Stripe initiation)

create unique index if not exists events_offline_payment_recorded_tx_uq
  on public.events ((payload->>'transaction_id'))
  where event_type = 'OfflinePaymentRecorded'
    and (payload ? 'transaction_id')
    and (payload->>'transaction_id') is not null;

create unique index if not exists events_payment_succeeded_tx_uq
  on public.events ((payload->>'transaction_id'))
  where event_type = 'PaymentSucceeded'
    and (payload ? 'transaction_id')
    and (payload->>'transaction_id') is not null;

create unique index if not exists events_invoice_paid_tx_uq
  on public.events ((payload->>'transaction_id'))
  where event_type = 'InvoicePaid'
    and (payload ? 'transaction_id')
    and (payload->>'transaction_id') is not null;

create unique index if not exists events_payment_initiated_checkout_session_uq
  on public.events ((payload->>'checkout_session_id'))
  where event_type = 'PaymentInitiated'
    and (payload ? 'checkout_session_id')
    and (payload->>'checkout_session_id') is not null;

