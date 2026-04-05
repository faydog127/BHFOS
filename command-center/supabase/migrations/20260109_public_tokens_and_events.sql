-- Migration: Add public tokens + public events audit log

create extension if not exists pgcrypto;

alter table public.quotes
  add column if not exists public_token uuid unique default gen_random_uuid();

update public.quotes
  set public_token = gen_random_uuid()
  where public_token is null;

alter table public.invoices
  add column if not exists public_token uuid unique default gen_random_uuid();

update public.invoices
  set public_token = gen_random_uuid()
  where public_token is null;

create table if not exists public.public_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null,
  tenant_id text,
  quote_id uuid,
  invoice_id uuid,
  token_hash text,
  ip_address text,
  user_agent text,
  status text,
  metadata jsonb
);

alter table public.public_events enable row level security;
