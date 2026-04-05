-- P0-02.D — Public-pay initiation boundary
-- Purpose:
-- - Public-pay must be an initiation-only surface (not a second money authority).
-- - Repeated submits must be duplicate-safe via DB-backed idempotency.
-- - Initiation must converge with webhook settlement via provider_payment_id (Stripe PaymentIntent id).

create extension if not exists pgcrypto;

create table if not exists public.public_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  public_token uuid not null,

  provider text not null default 'stripe',
  method text not null default 'card',
  currency text not null default 'usd',
  amount_cents bigint not null,

  idempotency_key text not null,
  checkout_session_id text null,
  checkout_url text null,
  provider_payment_id text null, -- Stripe PaymentIntent id (canonical)

  attempt_status text not null default 'initiated', -- initiated|pending|succeeded|failed|cancelled
  run_id text null,
  client_ip text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint public_payment_attempts_amount_positive check (amount_cents > 0)
);

create index if not exists public_payment_attempts_invoice_idx
  on public.public_payment_attempts (invoice_id, created_at desc);

create unique index if not exists ux_public_payment_attempts_invoice_idempotency
  on public.public_payment_attempts (invoice_id, idempotency_key);

create unique index if not exists ux_public_payment_attempts_provider_payment_id
  on public.public_payment_attempts (provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists ux_public_payment_attempts_checkout_session_id
  on public.public_payment_attempts (checkout_session_id)
  where checkout_session_id is not null;

