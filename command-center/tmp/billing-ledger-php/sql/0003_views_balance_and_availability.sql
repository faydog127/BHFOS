-- Derived balance/availability views with hard filtering rules.

create or replace view invoice_balance_view as
select
  i.invoice_record_id,
  i.invoice_number,
  i.billing_case_id,
  i.payer_id,
  i.currency_code,
  i.status,
  i.collection_status,
  i.issue_date,
  i.due_date,
  i.grand_total_cents,
  coalesce(pa.payments_applied_cents, 0) as payments_applied_cents,
  coalesce(ca.credits_applied_cents, 0) as credits_applied_cents,
  coalesce(wo.writeoffs_applied_cents, 0) as writeoffs_applied_cents,
  case
    when i.status = 'void' then 0
    else greatest(
      0,
      i.grand_total_cents
      - coalesce(pa.payments_applied_cents, 0)
      - coalesce(ca.credits_applied_cents, 0)
      - coalesce(wo.writeoffs_applied_cents, 0)
    )
  end as balance_due_cents
from invoices i
left join (
  select
    pa.invoice_record_id,
    sum(pa.applied_cents) as payments_applied_cents
  from payment_allocations pa
  join payments p on p.payment_record_id = pa.payment_record_id
  where p.status = 'settled'
  group by pa.invoice_record_id
) pa on pa.invoice_record_id = i.invoice_record_id
left join (
  select
    ca.invoice_record_id,
    sum(ca.applied_cents) as credits_applied_cents
  from credit_applications ca
  join credit_memos cm on cm.credit_memo_record_id = ca.credit_memo_record_id
  where cm.status = 'issued'
  group by ca.invoice_record_id
) ca on ca.invoice_record_id = i.invoice_record_id
left join (
  select
    iw.invoice_record_id,
    sum(iw.applied_cents) as writeoffs_applied_cents
  from invoice_writeoffs iw
  group by iw.invoice_record_id
) wo on wo.invoice_record_id = i.invoice_record_id;

create or replace view payment_available_balance_view as
select
  p.payment_record_id,
  p.payer_id,
  p.currency_code,
  p.amount_cents,
  p.status,
  coalesce(sum(pa.applied_cents), 0) as applied_cents,
  case
    when p.status <> 'settled' then 0
    else greatest(
      0,
      p.amount_cents
      - coalesce((
        select sum(pr.refund_amount_cents)
        from payment_refunds pr
        where pr.payment_record_id = p.payment_record_id
          and pr.status = 'settled'
      ), 0)
      - coalesce(sum(pa.applied_cents), 0)
    )
  end as unapplied_cents
from payments p
left join payment_allocations pa
  on pa.payment_record_id = p.payment_record_id
group by
  p.payment_record_id,
  p.payer_id,
  p.currency_code,
  p.amount_cents,
  p.status;

create or replace view credit_memo_available_balance_view as
select
  cm.credit_memo_record_id,
  cm.billing_case_id,
  cm.payer_id,
  cm.currency_code,
  cm.credit_total_cents,
  cm.status,
  case
    when cm.status <> 'issued' then 0
    else greatest(0, cm.credit_total_cents - coalesce(sum(ca.applied_cents), 0))
  end as unapplied_cents
from credit_memos cm
left join credit_applications ca
  on ca.credit_memo_record_id = cm.credit_memo_record_id
group by
  cm.credit_memo_record_id,
  cm.billing_case_id,
  cm.payer_id,
  cm.currency_code,
  cm.credit_total_cents,
  cm.status;

