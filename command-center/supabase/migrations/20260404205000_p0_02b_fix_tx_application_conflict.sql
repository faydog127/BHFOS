-- Avoid PL/pgSQL ambiguity between function output params and column names by using ON CONSTRAINT.

do $$
begin
  if to_regclass('public.transaction_applications') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transaction_applications_tx_invoice_uniq'
      and conrelid = 'public.transaction_applications'::regclass
  ) then
    alter table public.transaction_applications
      add constraint transaction_applications_tx_invoice_uniq
      unique (transaction_id, invoice_id);
  end if;
end $$;

create or replace function public.record_offline_manual_payment(
  p_tenant_id text,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_manual_reference_raw text,
  p_actor_user_id uuid,
  p_request_id text default null
)
returns table (
  ok boolean,
  duplicate boolean,
  transaction_id uuid,
  payment_attempt_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference_norm text;
  v_idempotency_key text;
  v_attempt record;
  v_invoice record;
  v_has_apps boolean := false;
  v_method text;
  v_transaction_id uuid;
begin
  if p_tenant_id is null or btrim(p_tenant_id) = '' then
    raise exception 'TENANT_ID_REQUIRED';
  end if;
  if p_invoice_id is null then
    raise exception 'INVOICE_ID_REQUIRED';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_INVALID';
  end if;

  v_reference_norm := public.normalize_manual_reference(p_manual_reference_raw);
  if v_reference_norm is null or btrim(v_reference_norm) = '' then
    raise exception 'MANUAL_REFERENCE_REQUIRED';
  end if;

  if length(v_reference_norm) < 4 or v_reference_norm ~ '^[0-9]{1,3}$' then
    raise exception 'MANUAL_REFERENCE_REJECTED';
  end if;

  if lower(v_reference_norm) in ('cash', 'paid', 'manual', 'offline', 'na', 'n/a', 'none', 'unknown', 'test') then
    raise exception 'MANUAL_REFERENCE_REJECTED';
  end if;

  v_idempotency_key := format('manual:%s:%s', p_invoice_id, v_reference_norm);
  v_method := coalesce(nullif(btrim(p_payment_method), ''), 'offline');

  select id, tenant_id, amount_paid, status
  into v_invoice
  from public.invoices
  where id = p_invoice_id
    and tenant_id is not distinct from p_tenant_id
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if lower(coalesce(v_invoice.status, '')) in ('void', 'voided', 'refunded') then
    raise exception 'INVOICE_NOT_PAYABLE';
  end if;

  select exists(
    select 1
    from public.transaction_applications ta
    where ta.invoice_id = p_invoice_id
      and ta.tenant_id = p_tenant_id
  ) into v_has_apps;

  if coalesce(v_invoice.amount_paid, 0) > 0 and not v_has_apps then
    raise exception 'LEGACY_MONEY_STATE_MIGRATION_REQUIRED';
  end if;

  insert into public.payment_attempts (
    tenant_id,
    invoice_id,
    writer_mode,
    idempotency_key,
    manual_reference_raw,
    manual_reference_norm,
    amount,
    payment_method,
    attempt_status,
    created_by_user_id,
    request_id,
    updated_at
  )
  values (
    p_tenant_id,
    p_invoice_id,
    'offline',
    v_idempotency_key,
    p_manual_reference_raw,
    v_reference_norm,
    p_amount,
    v_method,
    'received',
    p_actor_user_id,
    p_request_id,
    now()
  )
  on conflict (tenant_id, invoice_id, manual_reference_norm)
  do update
    set updated_at = now()
  returning * into v_attempt;

  if v_attempt.resolved_transaction_id is not null then
    ok := true;
    duplicate := true;
    transaction_id := v_attempt.resolved_transaction_id;
    payment_attempt_id := v_attempt.id;
    return next;
    return;
  end if;

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
    manual_reference_norm,
    created_by_user_id,
    recorded_at
  )
  values (
    p_tenant_id,
    p_invoice_id,
    p_amount,
    v_method,
    'succeeded',
    now(),
    'offline',
    'usd',
    null,
    v_idempotency_key,
    v_reference_norm,
    p_actor_user_id,
    now()
  )
  on conflict (tenant_id, idempotency_key)
  do update
    set recorded_at = excluded.recorded_at
  returning id into v_transaction_id;

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
    p_tenant_id,
    v_transaction_id,
    p_invoice_id,
    p_amount,
    'payment',
    p_actor_user_id,
    jsonb_build_object('manual_reference', v_reference_norm)
  )
  on conflict on constraint transaction_applications_tx_invoice_uniq
  do nothing;

  update public.payment_attempts
  set
    resolved_transaction_id = v_transaction_id,
    attempt_status = 'resolved',
    updated_at = now()
  where id = v_attempt.id;

  perform public.recalculate_invoice_settlement(p_invoice_id);

  ok := true;
  duplicate := false;
  transaction_id := v_transaction_id;
  payment_attempt_id := v_attempt.id;
  return next;
end;
$$;

