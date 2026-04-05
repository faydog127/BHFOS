create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  quote_number text,
  status text,
  subtotal numeric,
  tax_rate numeric,
  tax_amount numeric,
  total_amount numeric,
  valid_until timestamptz,
  header_text text,
  footer_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  estimate_id uuid,
  user_id uuid,
  fulfillment_mode text,
  customer_email text,
  tenant_id text,
  public_token uuid unique default gen_random_uuid()
);

create index if not exists idx_quotes_tenant_id
  on public.quotes (tenant_id);

create index if not exists idx_quotes_status
  on public.quotes (status);
