-- Mock payment processing RPC
-- NOTE: This is intentionally gated. It will throw unless `global_config.payments_mode = 'mock'`.
-- Local smoke tests set this flag; production should not.

create or replace function public.process_public_payment(
  p_token uuid,
  p_amount numeric,
  p_method text
)
returns jsonb
language plpgsql
as $$
declare
  v_mode text;
  v_invoice public.invoices%rowtype;
  v_transaction_id uuid;
begin
  select value into v_mode
  from public.global_config
  where key = 'payments_mode'
  limit 1;

  if coalesce(v_mode, '') <> 'mock' then
    raise exception 'Payment processing is not configured.';
  end if;

  select *
  into v_invoice
  from public.invoices
  where public_token = p_token
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount.';
  end if;

  if v_invoice.status = 'paid'
    or v_invoice.paid_at is not null
    or coalesce(v_invoice.balance_due, 0) <= 0 then
    select id
    into v_transaction_id
    from public.transactions
    where invoice_id = v_invoice.id
      and status = 'paid'
    order by created_at desc
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'mode', 'mock',
      'already_paid', true,
      'invoice_id', v_invoice.id,
      'transaction_id', v_transaction_id
    );
  end if;

  -- Update invoice to paid. Some environments treat balance_due as generated, so fall back.
  begin
    update public.invoices
    set status = 'paid',
        paid_at = now(),
        payment_method = p_method,
        amount_paid = coalesce(amount_paid, 0) + p_amount,
        balance_due = greatest(coalesce(balance_due, 0) - p_amount, 0),
        updated_at = now()
    where id = v_invoice.id;
  exception
    when others then
      update public.invoices
      set status = 'paid',
          paid_at = now(),
          payment_method = p_method,
          amount_paid = coalesce(amount_paid, 0) + p_amount,
          updated_at = now()
      where id = v_invoice.id;
  end;

  insert into public.transactions (
    tenant_id,
    invoice_id,
    amount,
    method,
    status
  ) values (
    v_invoice.tenant_id,
    v_invoice.id,
    p_amount,
    p_method,
    'paid'
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'ok', true,
    'mode', 'mock',
    'already_paid', false,
    'invoice_id', v_invoice.id,
    'transaction_id', v_transaction_id
  );
end;
$$;

-- Restrict execution to service role (public-pay edge function uses service role).
revoke execute on function public.process_public_payment(uuid, numeric, text) from public;
grant execute on function public.process_public_payment(uuid, numeric, text) to service_role;

