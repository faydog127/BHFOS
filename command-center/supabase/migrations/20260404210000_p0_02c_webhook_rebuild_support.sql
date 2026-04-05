-- P0-02.C — Payment webhook rebuild (supporting schema + RPC)
-- Scope: payment-webhook only. No public-pay refactor. No refunds/reversals.

-- -----------------------------------------
-- stripe_webhook_events: add processing fields
-- -----------------------------------------

alter table public.stripe_webhook_events
  add column if not exists processed_at timestamptz,
  add column if not exists processed_status text,
  add column if not exists provider_payment_id text,
  add column if not exists resolved_transaction_id uuid,
  add column if not exists reconciliation_required boolean default false,
  add column if not exists quarantine_reason text;

create index if not exists stripe_webhook_events_provider_payment_id_idx
  on public.stripe_webhook_events (provider_payment_id);

-- -----------------------------------------
-- invoices: reconciliation flag (webhook-safe)
-- -----------------------------------------

alter table public.invoices
  add column if not exists reconciliation_required boolean default false,
  add column if not exists reconciliation_reason text;

-- -----------------------------------------
-- transactions: webhook financial idempotency
-- -----------------------------------------

-- Ensure provider_reference uniqueness for webhook even when tenant context is missing/unknown.
create unique index if not exists ux_transactions_webhook_provider_reference
  on public.transactions (provider_reference)
  where source = 'webhook' and provider_reference is not null;

-- -----------------------------------------
-- RPC: record_stripe_webhook_payment
-- -----------------------------------------

create or replace function public.record_stripe_webhook_payment(
  p_gateway_event_id text,
  p_event_type text,
  p_provider_payment_id text,
  p_amount_cents bigint,
  p_currency text,
  p_payload jsonb,
  p_invoice_id uuid default null
)
returns table (
  ok boolean,
  duplicate_event boolean,
  duplicate_payment boolean,
  financial_effect_created boolean,
  reconciliation_required boolean,
  quarantined boolean,
  quarantine_reason text,
  transaction_id uuid,
  invoice_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_invoice record;
  v_tenant_id text;
  v_amount numeric;
  v_has_apps boolean := false;
  v_tx_id uuid;
  v_app_rows integer := 0;
  v_final_success boolean := false;
begin
  if p_gateway_event_id is null or btrim(p_gateway_event_id) = '' then
    raise exception 'GATEWAY_EVENT_ID_REQUIRED';
  end if;

  if p_provider_payment_id is null or btrim(p_provider_payment_id) = '' then
    raise exception 'PROVIDER_PAYMENT_ID_REQUIRED';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'AMOUNT_INVALID';
  end if;

  v_final_success := lower(coalesce(p_event_type, '')) in ('payment_intent.succeeded', 'charge.succeeded');
  v_amount := (p_amount_cents::numeric / 100.0);

  -- Network idempotency: one gateway_event_id recorded once.
  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    payment_intent_id,
    provider_payment_id,
    payload,
    processed_status,
    received_at
  )
  values (
    p_gateway_event_id,
    p_event_type,
    p_provider_payment_id,
    p_provider_payment_id,
    p_payload,
    'received',
    now()
  )
  on conflict (event_id) do nothing;

  select *
  into v_event
  from public.stripe_webhook_events
  where event_id = p_gateway_event_id;

  duplicate_event := (v_event.processed_status = 'processed');

  -- If this event isn't a final success, just acknowledge receipt (no financial effect).
  if not v_final_success then
    ok := true;
    duplicate_payment := false;
    financial_effect_created := false;
    reconciliation_required := false;
    quarantined := false;
    quarantine_reason := null;
    transaction_id := null;
    invoice_id := null;

    update public.stripe_webhook_events
    set processed_at = now(),
        processed_status = 'ignored_nonfinal'
    where event_id = p_gateway_event_id
      and processed_status <> 'processed';

    return next;
    return;
  end if;

  -- If we have an explicit invoice id, use it. Otherwise try provider_payment_id mapping.
  if p_invoice_id is not null then
    select id, tenant_id, amount_paid, status, total_amount
      into v_invoice
      from public.invoices
     where id = p_invoice_id
     for update;
  else
    select id, tenant_id, amount_paid, status, total_amount
      into v_invoice
      from public.invoices
     where provider_payment_id = p_provider_payment_id
     limit 1
     for update;
  end if;

  if not found then
    -- Ambiguous association: record money truth but quarantine application.
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
      recorded_at
    )
    values (
      null,
      null,
      v_amount,
      'stripe',
      'succeeded',
      now(),
      'webhook',
      coalesce(nullif(lower(btrim(p_currency)), ''), 'usd'),
      p_provider_payment_id,
      format('stripe:%s', p_provider_payment_id),
      now()
    )
    on conflict on constraint ux_transactions_webhook_provider_reference
    do update set recorded_at = excluded.recorded_at
    returning id into v_tx_id;

    update public.stripe_webhook_events
    set processed_at = now(),
        processed_status = 'quarantined_unmapped',
        invoice_id = null,
        provider_payment_id = p_provider_payment_id,
        resolved_transaction_id = v_tx_id,
        reconciliation_required = true,
        quarantine_reason = 'AMBIGUOUS_OR_MISSING_INVOICE_ASSOCIATION'
    where event_id = p_gateway_event_id;

    ok := true;
    duplicate_payment := true;
    financial_effect_created := false;
    reconciliation_required := true;
    quarantined := true;
    quarantine_reason := 'AMBIGUOUS_OR_MISSING_INVOICE_ASSOCIATION';
    transaction_id := v_tx_id;
    invoice_id := null;
    return next;
    return;
  end if;

  invoice_id := v_invoice.id;
  v_tenant_id := v_invoice.tenant_id;

  -- Legacy/corrupt state rule: do not reject valid external money. Quarantine application and flag reconciliation.
  select exists(
    select 1
      from public.transaction_applications ta
     where ta.invoice_id = v_invoice.id
       and ta.tenant_id is not distinct from v_tenant_id
  ) into v_has_apps;

  if coalesce(v_invoice.amount_paid, 0) > 0 and not v_has_apps then
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
      recorded_at
    )
    values (
      v_tenant_id,
      v_invoice.id,
      v_amount,
      'stripe',
      'succeeded',
      now(),
      'webhook',
      coalesce(nullif(lower(btrim(p_currency)), ''), 'usd'),
      p_provider_payment_id,
      format('stripe:%s', p_provider_payment_id),
      now()
    )
    on conflict on constraint ux_transactions_webhook_provider_reference
    do update set recorded_at = excluded.recorded_at
    returning id into v_tx_id;

    update public.invoices
    set reconciliation_required = true,
        reconciliation_reason = coalesce(reconciliation_reason, 'LEGACY_MONEY_STATE_WITHOUT_LEDGER'),
        updated_at = now()
    where id = v_invoice.id;

    update public.stripe_webhook_events
    set processed_at = now(),
        processed_status = 'quarantined_legacy_state',
        invoice_id = v_invoice.id,
        provider_payment_id = p_provider_payment_id,
        resolved_transaction_id = v_tx_id,
        reconciliation_required = true,
        quarantine_reason = 'LEGACY_MONEY_STATE_WITHOUT_LEDGER'
    where event_id = p_gateway_event_id;

    ok := true;
    duplicate_payment := true;
    financial_effect_created := false;
    reconciliation_required := true;
    quarantined := true;
    quarantine_reason := 'LEGACY_MONEY_STATE_WITHOUT_LEDGER';
    transaction_id := v_tx_id;
    return next;
    return;
  end if;

  -- Financial idempotency: provider_payment_id can create at most one transaction.
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
    recorded_at
  )
  values (
    v_tenant_id,
    v_invoice.id,
    v_amount,
    'stripe',
    'succeeded',
    now(),
    'webhook',
    coalesce(nullif(lower(btrim(p_currency)), ''), 'usd'),
    p_provider_payment_id,
    format('stripe:%s', p_provider_payment_id),
    now()
  )
  on conflict on constraint ux_transactions_webhook_provider_reference
  do update set recorded_at = excluded.recorded_at
  returning id into v_tx_id;

  -- Application idempotency: at most one application per transaction/invoice.
  insert into public.transaction_applications (
    tenant_id,
    transaction_id,
    invoice_id,
    applied_amount,
    application_type,
    metadata
  )
  values (
    v_tenant_id,
    v_tx_id,
    v_invoice.id,
    v_amount,
    'payment',
    jsonb_build_object('provider', 'stripe', 'provider_payment_id', p_provider_payment_id, 'gateway_event_id', p_gateway_event_id)
  )
  on conflict on constraint transaction_applications_tx_invoice_uniq
  do nothing;

  get diagnostics v_app_rows = row_count;
  financial_effect_created := (v_app_rows = 1);

  perform public.recalculate_invoice_settlement(v_invoice.id);

  update public.invoices
  set provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id),
      provider_payment_status = coalesce(provider_payment_status, 'succeeded'),
      updated_at = now()
  where id = v_invoice.id;

  update public.stripe_webhook_events
  set processed_at = now(),
      processed_status = 'processed',
      invoice_id = v_invoice.id,
      provider_payment_id = p_provider_payment_id,
      resolved_transaction_id = v_tx_id,
      reconciliation_required = false,
      quarantine_reason = null
  where event_id = p_gateway_event_id;

  ok := true;
  duplicate_payment := (v_app_rows = 0);
  reconciliation_required := false;
  quarantined := false;
  quarantine_reason := null;
  transaction_id := v_tx_id;
  return next;
end;
$$;

