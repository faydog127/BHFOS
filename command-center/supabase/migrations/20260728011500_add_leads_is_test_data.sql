-- The Command Center lead workflow reads and writes this discriminator to keep
-- training/test records isolated from normal CRM records.
-- Existing rows predate the discriminator and are therefore treated as non-test data.

alter table public.leads
  add column if not exists is_test_data boolean not null default false;

create index if not exists leads_tenant_is_test_data_idx
  on public.leads (tenant_id, is_test_data);
