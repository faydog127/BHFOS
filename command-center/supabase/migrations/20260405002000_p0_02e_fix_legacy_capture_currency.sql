-- P0-02.E — Fix legacy opening balance capture for schemas without invoices.currency

create or replace function public.reconcile_capture_legacy_invoice_opening_balance(
  p_invoice_id uuid,
  p_actor_user_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice record;
  v_has_apps boolean := false;
  v_idempotency_key text;
  v_tx_id uuid;
  v_app_id uuid;
  v_effect_created boolean := false;
begin
  if p_invoice_id is null then
    raise exception 'INVOICE_ID_REQUIRED';
  end if;

  select *
    into v_invoice
    from public.invoices
   where id = p_invoice_id
   for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if coalesce(v_invoice.amount_paid, 0) <= 0 then
    raise exception 'INVOICE_HAS_NO_LEGACY_AMOUNT_PAID';
  end if;

  select exists(
    select 1 from public.transaction_applications ta
    where ta.invoice_id = v_invoice.id
      and ta.tenant_id = v_invoice.tenant_id
  ) into v_has_apps;

  if v_has_apps then
    return jsonb_build_object('ok', true, 'duplicate', true, 'note', 'ledger_already_present');
  end if;

  if coalesce(v_invoice.total_amount, 0) > 0 and v_invoice.amount_paid > v_invoice.total_amount + 0.009 then
    raise exception 'LEGACY_AMOUNT_EXCEEDS_TOTAL';
  end if;

  v_idempotency_key := format('legacy_import:%s', v_invoice.id);

  insert into public.transactions (
    tenant_id,
    invoice_id,
    amount,
    method,
    status,
    created_at,
    source,
    currency,
    provider_reference,
    idempotency_key,
    recorded_at,
    created_by_user_id
  )
  values (
    v_invoice.tenant_id,
    v_invoice.id,
    v_invoice.amount_paid,
    'legacy_import',
    'succeeded',
    now(),
    'legacy_import',
    'usd',
    null,
    v_idempotency_key,
    now(),
    p_actor_user_id
  )
  on conflict (tenant_id, idempotency_key)
  do update set recorded_at = excluded.recorded_at
  returning id into v_tx_id;

  insert into public.transaction_applications (
    tenant_id,
    transaction_id,
    invoice_id,
    applied_amount,
    application_type,
    created_by_user_id,
    metadata
  )
  values (
    v_invoice.tenant_id,
    v_tx_id,
    v_invoice.id,
    v_invoice.amount_paid,
    'payment',
    p_actor_user_id,
    jsonb_build_object('legacy_opening_balance', true, 'note', p_note)
  )
  on conflict on constraint transaction_applications_tx_invoice_uniq
  do nothing
  returning id into v_app_id;

  v_effect_created := (v_app_id is not null);

  perform public.recalculate_invoice_settlement(v_invoice.id);

  update public.invoices
  set reconciliation_required = false,
      reconciliation_reason = null,
      updated_at = now()
  where id = v_invoice.id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', (not v_effect_created),
    'financial_effect_created', v_effect_created,
    'transaction_id', v_tx_id,
    'invoice_id', v_invoice.id,
    'transaction_application_id', v_app_id
  );
end;
$$;

