-- Ensure idempotent transforms for kanban cross-entity creation.

create unique index if not exists quotes_tenant_lead_unique
  on public.quotes (tenant_id, lead_id)
  where lead_id is not null;

create unique index if not exists jobs_tenant_quote_unique
  on public.jobs (tenant_id, quote_id)
  where quote_id is not null;

create unique index if not exists invoices_tenant_job_unique
  on public.invoices (tenant_id, job_id)
  where job_id is not null;
