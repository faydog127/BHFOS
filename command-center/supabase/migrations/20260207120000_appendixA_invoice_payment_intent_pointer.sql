-- Appendix A (Money Loop) - Payments foundation
-- Add a stable pointer for an invoice's active payment intent (Stripe or other provider).
-- This enables idempotent "reuse intent" behavior in `public-pay`.

alter table public.invoices
  add column if not exists provider_payment_id text,
  add column if not exists provider_payment_status text;

-- Useful for mapping provider callbacks/webhooks back to invoices.
create unique index if not exists invoices_provider_payment_id_uq
  on public.invoices (provider_payment_id)
  where provider_payment_id is not null;

