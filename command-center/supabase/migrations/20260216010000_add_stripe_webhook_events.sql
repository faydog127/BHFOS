-- A-EXEC-2: Stripe webhook idempotency guard
-- Additive-only, idempotent.

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now(),
  event_type text,
  invoice_id uuid,
  payment_intent_id text,
  payload jsonb
);

create index if not exists stripe_webhook_events_invoice_id_idx
  on public.stripe_webhook_events (invoice_id);

create index if not exists stripe_webhook_events_payment_intent_id_idx
  on public.stripe_webhook_events (payment_intent_id);
