-- Core transactional tables required for local development.
-- This repo historically referenced these tables from UI/Edge Functions,
-- but did not include the CREATE TABLE DDL in migrations, which breaks `supabase start`.
--
-- Goals:
-- 1) Unblock `supabase start` by ensuring all downstream migrations apply cleanly.
-- 2) Provide the minimal schema needed for Money Loop public endpoints + task creation.
--
-- Notes:
-- - Additive/idempotent only (CREATE TABLE IF NOT EXISTS).
-- - Keep tenant_id as TEXT (matches existing data usage like 'tvg').

create extension if not exists pgcrypto;

-- -----------------------------
-- Contacts / Properties / Leads
-- -----------------------------

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  first_name text,
  last_name text,
  company text,
  email text,
  phone text,
  is_customer boolean not null default false,
  customer_created_at timestamptz,
  manual_convert_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_tenant_id_idx on public.contacts (tenant_id);
create index if not exists contacts_email_idx on public.contacts (email);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  address1 text,
  address2 text,
  city text,
  state text,
  zip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_tenant_id_idx on public.properties (tenant_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  contact_id uuid,
  property_id uuid,
  first_name text,
  last_name text,
  company text,
  email text,
  phone text,
  service text,
  source text,
  source_detail text,
  partner_referral_code text,
  is_partner boolean not null default false,
  status text,
  stage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_contact_id_fkey foreign key (contact_id) references public.contacts (id) on delete set null,
  constraint leads_property_id_fkey foreign key (property_id) references public.properties (id) on delete set null
);

create index if not exists leads_tenant_id_idx on public.leads (tenant_id);
create index if not exists leads_contact_id_idx on public.leads (contact_id);
create index if not exists leads_property_id_idx on public.leads (property_id);

-- -------------
-- Quotes / Items
-- -------------

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  quote_number text,
  status text,
  subtotal numeric,
  tax_rate numeric,
  tax_amount numeric,
  total_amount numeric,
  valid_until date,
  header_text text,
  footer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
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
  public_token uuid unique default gen_random_uuid(),
  constraint quotes_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete set null
);

create index if not exists quotes_tenant_id_idx on public.quotes (tenant_id);
create index if not exists quotes_lead_id_idx on public.quotes (lead_id);
create index if not exists quotes_public_token_idx on public.quotes (public_token);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null,
  description text,
  quantity numeric,
  unit_price numeric,
  total_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_items_quote_id_fkey foreign key (quote_id) references public.quotes (id) on delete cascade
);

create index if not exists quote_items_quote_id_idx on public.quote_items (quote_id);

-- ----
-- Jobs
-- ----

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  lead_id uuid,
  quote_id uuid,
  status text not null default 'UNSCHEDULED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete set null,
  constraint jobs_quote_id_fkey foreign key (quote_id) references public.quotes (id) on delete set null
);

create index if not exists jobs_tenant_id_idx on public.jobs (tenant_id);
create index if not exists jobs_quote_id_idx on public.jobs (quote_id);
create index if not exists jobs_lead_id_idx on public.jobs (lead_id);

-- ---------------
-- Invoices / Items
-- ---------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  appointment_id uuid,
  quote_id uuid,
  job_id uuid,
  invoice_number text,
  status text,
  subtotal numeric,
  tax_rate numeric,
  tax_amount numeric,
  total_amount numeric,
  amount_paid numeric,
  balance_due numeric,
  due_date date,
  paid_at timestamptz,
  payment_method text,
  notes text,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  public_token uuid unique default gen_random_uuid(),
  discount_amount numeric,
  pdf_url text,
  issue_date date,
  is_test_data boolean,
  customer_email text,
  account_id uuid,
  property_id uuid,
  estimate_id uuid,
  quickbooks_id text,
  quickbooks_sync_status text,
  tenant_id text,
  constraint invoices_lead_id_fkey foreign key (lead_id) references public.leads (id) on delete set null,
  constraint invoices_quote_id_fkey foreign key (quote_id) references public.quotes (id) on delete set null,
  constraint invoices_job_id_fkey foreign key (job_id) references public.jobs (id) on delete set null,
  constraint invoices_property_id_fkey foreign key (property_id) references public.properties (id) on delete set null
);

create index if not exists invoices_tenant_id_idx on public.invoices (tenant_id);
create index if not exists invoices_lead_id_idx on public.invoices (lead_id);
create index if not exists invoices_quote_id_idx on public.invoices (quote_id);
create index if not exists invoices_job_id_idx on public.invoices (job_id);
create index if not exists invoices_public_token_idx on public.invoices (public_token);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  description text,
  quantity numeric,
  unit_price numeric,
  total_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_items_invoice_id_fkey foreign key (invoice_id) references public.invoices (id) on delete cascade
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- ------------
-- Tasks / Money
-- ------------

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  owner_user_id uuid,
  lead_id uuid,
  source_type text,
  source_id uuid,
  type text,
  title text,
  status text not null default 'open',
  due_at timestamptz,
  priority text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists crm_tasks_tenant_id_idx on public.crm_tasks (tenant_id);
create index if not exists crm_tasks_status_base_idx on public.crm_tasks (status);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  invoice_id uuid,
  amount numeric,
  method text,
  status text,
  created_at timestamptz not null default now(),
  constraint transactions_invoice_id_fkey foreign key (invoice_id) references public.invoices (id) on delete set null
);

create index if not exists transactions_tenant_id_idx on public.transactions (tenant_id);
create index if not exists transactions_invoice_id_idx on public.transactions (invoice_id);
