begin;
-- Purpose
-- - Legacy work orders may have `jobs.payment_status='paid'` while the invoice is not linked (`invoices.job_id is null`)
--   or has no settlement-backed money proof (no `transaction_applications`), which causes UI and reporting drift.
--
-- This migration is intentionally conservative:
-- 1) Link invoices -> jobs only when the mapping is unambiguous (invoice.quote_id -> job.quote_id is 1:1).
-- 2) For jobs marked paid, if the linked invoice has no settlement applications, create a single deterministic
--    legacy-backfill transaction + application (idempotent via unique idempotency_key), then recompute settlement.
--
-- Non-goals:
-- - Does not guess linkage based on lead_id alone.
-- - Does not backfill partial payments (amount is ambiguous without a trusted source).
-- - Does not modify webhook/public-pay logic.

create temporary table if not exists tmp_legacy_invoice_job_link_candidates as
with invoice_candidates as (
  select
    i.id as invoice_id,
    i.tenant_id as tenant_id,
    i.quote_id as quote_id
  from public.invoices i
  where i.job_id is null
    and i.quote_id is not null
),
job_matches as (
  select
    ic.invoice_id,
    ic.tenant_id,
    j.id as job_id
  from invoice_candidates ic
  join public.jobs j
    on j.quote_id = ic.quote_id
   and j.tenant_id is not distinct from ic.tenant_id
),
unique_matches as (
  select
    jm.invoice_id,
    jm.tenant_id,
    max(jm.job_id::text)::uuid as job_id,
    count(*) as match_count
  from job_matches jm
  group by jm.invoice_id, jm.tenant_id
)
select invoice_id, tenant_id, job_id
from unique_matches
where match_count = 1;
update public.invoices i
set
  job_id = c.job_id,
  updated_at = now()
from tmp_legacy_invoice_job_link_candidates c
where i.id = c.invoice_id
  and i.tenant_id is not distinct from c.tenant_id
  and i.job_id is null;
create temporary table if not exists tmp_legacy_paid_invoices_to_backfill as
select
  i.id as invoice_id,
  i.tenant_id as tenant_id,
  i.job_id as job_id,
  coalesce(i.total_amount, 0) as total_amount
from public.invoices i
join public.jobs j
  on j.id = i.job_id
 and j.tenant_id is not distinct from i.tenant_id
where lower(btrim(coalesce(j.payment_status, ''))) = 'paid'
  and lower(btrim(coalesce(i.status, ''))) not in ('paid', 'void')
  and coalesce(i.total_amount, 0) > 0
  and not exists (
    select 1
    from public.transaction_applications ta
    where ta.invoice_id = i.id
      and ta.tenant_id is not distinct from i.tenant_id
  );
-- Create one deterministic legacy backfill transaction per invoice.
do $$
begin
  -- Production may enforce additional NOT NULL / CHECK constraints on transactions.
  -- In particular, some environments require:
  -- - transactions.type in ('charge','refund','adjustment')
  -- - transactions.method in ('card','ach','cash','check','financing')
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'type'
  ) then
    execute $sql$
      insert into public.transactions (
        tenant_id,
        invoice_id,
        amount,
        type,
        method,
        status,
        source,
        currency,
        provider_reference,
        idempotency_key,
        recorded_at,
        created_by_user_id
      )
      select
        t.tenant_id,
        t.invoice_id,
        t.total_amount,
        'charge',
        'cash',
        'succeeded',
        'legacy_backfill',
        'usd',
        null,
        'legacy_job_paid:' || t.job_id::text || ':' || t.invoice_id::text,
        now(),
        null
      from tmp_legacy_paid_invoices_to_backfill t
      on conflict (tenant_id, idempotency_key) do nothing
    $sql$;
  else
    execute $sql$
      insert into public.transactions (
        tenant_id,
        invoice_id,
        amount,
        method,
        status,
        source,
        currency,
        provider_reference,
        idempotency_key,
        recorded_at,
        created_by_user_id
      )
      select
        t.tenant_id,
        t.invoice_id,
        t.total_amount,
        'cash',
        'succeeded',
        'legacy_backfill',
        'usd',
        null,
        'legacy_job_paid:' || t.job_id::text || ':' || t.invoice_id::text,
        now(),
        null
      from tmp_legacy_paid_invoices_to_backfill t
      on conflict (tenant_id, idempotency_key) do nothing
    $sql$;
  end if;
end $$;
-- Apply the transaction to the invoice (idempotent via unique index).
insert into public.transaction_applications (
  tenant_id,
  transaction_id,
  invoice_id,
  applied_amount,
  application_type,
  metadata,
  created_by_user_id,
  applied_at
)
select
  t.tenant_id,
  tx.id as transaction_id,
  t.invoice_id,
  t.total_amount,
  'payment',
  jsonb_build_object(
    'source', 'legacy_job_paid_backfill',
    'job_id', t.job_id
  ),
  null,
  now()
from tmp_legacy_paid_invoices_to_backfill t
join public.transactions tx
  on tx.tenant_id is not distinct from t.tenant_id
 and tx.idempotency_key = ('legacy_job_paid:' || t.job_id::text || ':' || t.invoice_id::text)
on conflict (transaction_id, invoice_id) do nothing;
-- Recompute settlement for invoices affected by this backfill.
do $$
declare
  r record;
begin
  -- Some environments define invoices.balance_due as a generated column, which breaks
  -- older settlement recompute routines that try to write balance_due directly.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'balance_due'
      and is_generated = 'ALWAYS'
  ) then
    update public.invoices i
    set
      amount_paid = greatest(coalesce(i.amount_paid, 0), coalesce(i.total_amount, 0)),
      updated_at = now()
    where i.id in (select invoice_id from tmp_legacy_paid_invoices_to_backfill);
  else
    for r in (select invoice_id from tmp_legacy_paid_invoices_to_backfill) loop
      perform public.recalculate_invoice_settlement(r.invoice_id);
    end loop;
  end if;
end $$;
-- Minimal audit breadcrumb (does not affect money truth).
insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, payload)
select
  t.tenant_id,
  'invoice',
  t.invoice_id,
  'LegacyPaid_BackfillApplied',
  'system',
  jsonb_build_object('job_id', t.job_id, 'idempotency_key', 'legacy_job_paid:' || t.job_id::text || ':' || t.invoice_id::text)
from tmp_legacy_paid_invoices_to_backfill t;
commit;
