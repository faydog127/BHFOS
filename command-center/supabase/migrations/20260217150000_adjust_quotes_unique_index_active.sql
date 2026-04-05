-- Allow multiple historical quotes per lead while preserving active-quote idempotency.
-- Existing index blocked any second quote for the same lead, even after accepted/declined.

drop index if exists public.quotes_tenant_lead_unique;

create unique index if not exists quotes_tenant_lead_active_unique
  on public.quotes (tenant_id, lead_id)
  where lead_id is not null
    and lower(coalesce(status, 'draft')) in ('draft', 'pending_review', 'sent', 'viewed');
