begin;
-- Fix: operational_stage should treat the latest invoice as authority when present.
-- This prevents jobs marked `payment_status='paid'` from appearing operationally paid
-- when the linked invoice is still unpaid/sent/partial/etc.

create or replace view public.job_operational_state_v1
with (security_invoker = true)
as
with latest_invoice as (
  select distinct on (i.job_id)
    i.job_id,
    i.id,
    lower(btrim(coalesce(i.status, ''))) as status,
    i.invoice_number,
    i.due_date,
    i.sent_at,
    i.balance_due,
    i.total_amount,
    i.created_at
  from public.invoices as i
  where i.job_id is not null
  order by i.job_id, i.created_at desc, i.id desc
),
base as (
  select
    j.id,
    j.tenant_id,
    lower(btrim(coalesce(j.status, 'unscheduled'))) as status,
    lower(btrim(coalesce(j.payment_status, 'unpaid'))) as payment_status,
    j.scheduled_start,
    j.scheduled_end,
    j.service_address,
    j.technician_id,
    j.updated_at,
    j.completed_at,
    j.total_amount,
    j.work_order_number,
    j.job_number,
    j.quote_id,
    j.quote_number,
    j.lead_id,
    j.created_at,
    upper(btrim(coalesce(j.payment_terms, public.default_job_payment_terms(j.customer_type_snapshot)))) as payment_terms,
    public.normalize_job_customer_type(j.customer_type_snapshot) as customer_type_snapshot,
    li.id as latest_invoice_id,
    li.status as latest_invoice_status,
    li.invoice_number as latest_invoice_number,
    li.due_date as latest_invoice_due_date,
    li.balance_due as latest_invoice_balance_due,
    l.first_name as lead_first_name,
    l.last_name as lead_last_name,
    l.phone as lead_phone,
    l.email as lead_email
  from public.jobs as j
  left join latest_invoice as li
    on li.job_id = j.id
  left join public.leads as l
    on l.id = j.lead_id
),
staged as (
  select
    b.*,
    case
      -- When an invoice exists, invoice status is the operational authority for stage.
      when b.latest_invoice_id is not null and b.latest_invoice_status = 'paid' then 'paid'
      when b.latest_invoice_id is not null and b.latest_invoice_status = 'draft' then 'invoice_draft'
      when b.latest_invoice_id is not null and b.latest_invoice_status in ('sent', 'partial', 'overdue', 'accepted', 'approved') then 'invoiced'
      when b.latest_invoice_id is not null then 'invoiced'

      -- Legacy / invoice-less jobs fall back to the job payment flag.
      when b.payment_status = 'paid' then 'paid'

      when b.status in ('unscheduled', 'pending_schedule', 'scheduled', 'en_route', 'in_progress', 'on_hold', 'completed', 'cancelled') then b.status
      else 'unscheduled'
    end as operational_stage
  from base as b
),
timed as (
  select
    s.*,
    case
      when s.operational_stage in ('unscheduled', 'pending_schedule')
        then coalesce(s.updated_at, s.created_at) + interval '24 hours'
      when s.operational_stage = 'scheduled'
        then s.scheduled_start
      when s.operational_stage = 'invoice_draft'
        then coalesce(s.completed_at, s.updated_at, s.created_at) + interval '12 hours'
      when s.operational_stage = 'invoiced'
        then coalesce(
          s.latest_invoice_due_date::timestamptz,
          s.completed_at + make_interval(days => public.payment_terms_due_days(s.payment_terms)),
          s.updated_at + make_interval(days => public.payment_terms_due_days(s.payment_terms))
        )
      else null
    end as due_at
  from staged as s
)
select
  t.*,
  case
    when t.operational_stage in ('unscheduled', 'pending_schedule') then 10
    when t.operational_stage = 'scheduled' then 20
    when t.operational_stage = 'en_route' then 30
    when t.operational_stage = 'in_progress' then 40
    when t.operational_stage = 'on_hold' then 45
    when t.operational_stage = 'invoice_draft' then 50
    when t.operational_stage = 'invoiced' then 60
    when t.operational_stage = 'completed' then 70
    when t.operational_stage = 'paid' then 80
    when t.operational_stage = 'cancelled' then 90
    else 95
  end as operational_sort,
  (
    t.due_at is not null
    and t.due_at < now()
    and t.operational_stage not in ('paid', 'cancelled')
  ) as is_overdue,
  case
    when t.due_at is null then null
    when t.due_at >= now() then null
    when t.operational_stage in ('unscheduled', 'pending_schedule') then 'Scheduling overdue'
    when t.operational_stage = 'scheduled' then 'Dispatch overdue'
    when t.operational_stage = 'invoice_draft' then 'Invoice draft overdue'
    when t.operational_stage = 'invoiced' then 'Invoice overdue'
    else 'Attention needed'
  end as overdue_reason,
  case
    when t.operational_stage in ('unscheduled', 'pending_schedule') then 'Schedule'
    when t.operational_stage = 'scheduled' then 'Start'
    when t.operational_stage in ('en_route', 'in_progress') then 'Complete'
    when t.operational_stage = 'invoice_draft' then 'Send Invoice'
    when t.operational_stage = 'invoiced' then 'Collect Payment'
    when t.operational_stage = 'paid' then 'Closed'
    when t.operational_stage = 'on_hold' then 'Resume'
    else 'Open'
  end as next_action_label
from timed as t;
grant select on public.job_operational_state_v1 to authenticated, service_role;
commit;
