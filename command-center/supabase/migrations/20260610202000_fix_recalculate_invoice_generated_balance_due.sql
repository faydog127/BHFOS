-- Live TVG settlement fix:
-- do not write invoices.balance_due when it is a generated column.

create or replace function public.recalculate_invoice_settlement(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice record;
  v_paid numeric := 0;
  v_total numeric := 0;
  v_due numeric := 0;
  v_last_payment_at timestamptz := null;
  v_status text := null;
  v_settlement_status text := null;
  v_method text := null;
begin
  if p_invoice_id is null then
    raise exception 'invoice_id is required';
  end if;

  select id, tenant_id, total_amount, amount_paid, status, paid_at, sent_at
  into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  select
    coalesce(sum(ta.applied_amount), 0),
    max(t.recorded_at),
    (array_agg(t.method order by t.recorded_at desc))[1]
  into v_paid, v_last_payment_at, v_method
  from public.transaction_applications ta
  join public.transactions t on t.id = ta.transaction_id
  where ta.invoice_id = p_invoice_id
    and ta.tenant_id = v_invoice.tenant_id
    and t.tenant_id = v_invoice.tenant_id
    and lower(coalesce(t.status, '')) in ('succeeded', 'paid', 'success');

  v_total := coalesce(v_invoice.total_amount, 0);
  v_due := greatest(v_total - v_paid, 0);

  if v_paid <= 0 then
    v_settlement_status := 'unpaid';
  elsif v_total <= 0 then
    v_settlement_status := 'paid';
  elsif v_due <= 0.009 then
    v_settlement_status := 'paid';
  else
    v_settlement_status := 'partial';
  end if;

  if v_paid > 0 then
    v_status := case when v_settlement_status = 'paid' then 'paid' else 'partial' end;
  end if;

  update public.invoices
  set
    amount_paid = v_paid,
    settlement_status = v_settlement_status,
    last_payment_at = v_last_payment_at,
    payment_method = coalesce(v_method, payment_method),
    paid_at = case
      when v_settlement_status = 'paid' and paid_at is null then coalesce(v_last_payment_at, now())
      else paid_at
    end,
    status = case
      when v_status is not null then v_status
      else status
    end,
    updated_at = now()
  where id = p_invoice_id;
end;
$$;
