-- P0-02.E — Reconciliation sweep + resolution tools
--
-- Goal: provide deterministic, auditable mechanisms to resolve:
-- - webhook quarantines (unmapped payments, legacy-state quarantines)
-- - invoices flagged reconciliation_required
-- - legacy money state without ledger (capture opening balance into ledger)

-- ----------------------------
-- Reconciliation queue view (operational list)
-- ----------------------------

create or replace view public.reconciliation_queue as
select
  'invoice'::text as item_type,
  i.tenant_id,
  i.id as invoice_id,
  null::uuid as transaction_id,
  null::text as gateway_event_id,
  i.reconciliation_reason as reason,
  i.updated_at as updated_at,
  i.created_at as created_at
from public.invoices i
where coalesce(i.reconciliation_required, false) = true

union all

select
  'webhook_event'::text as item_type,
  i.tenant_id,
  e.invoice_id,
  e.resolved_transaction_id as transaction_id,
  e.event_id as gateway_event_id,
  coalesce(e.quarantine_reason, e.processed_status, 'reconciliation_required') as reason,
  coalesce(e.processed_at, e.received_at) as updated_at,
  e.received_at as created_at
from public.stripe_webhook_events e
left join public.invoices i on i.id = e.invoice_id
where coalesce(e.reconciliation_required, false) = true;

-- ----------------------------
-- Resolve: apply a quarantined webhook transaction to a known invoice
-- ----------------------------

create or replace function public.reconcile_apply_webhook_transaction_to_invoice(
  p_transaction_id uuid,
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
  v_tx record;
  v_invoice record;
  v_app_id uuid;
  v_existing_app uuid;
  v_effect_created boolean := false;
  v_has_invoice_paid_event boolean := false;
  v_has_payment_succeeded_event boolean := false;
begin
  if p_transaction_id is null then
    raise exception 'TRANSACTION_ID_REQUIRED';
  end if;
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

  select *
    into v_tx
    from public.transactions
   where id = p_transaction_id
   for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;

  if lower(coalesce(v_tx.source, '')) <> 'webhook' then
    raise exception 'TRANSACTION_SOURCE_NOT_WEBHOOK';
  end if;

  if lower(coalesce(v_tx.status, '')) not in ('succeeded', 'paid', 'success') then
    raise exception 'TRANSACTION_NOT_SETTLED';
  end if;

  -- If the invoice has a pinned provider_payment_id, it must match this transaction's provider_reference when present.
  if v_invoice.provider_payment_id is not null and v_tx.provider_reference is not null
     and v_invoice.provider_payment_id <> v_tx.provider_reference then
    raise exception 'PROVIDER_PAYMENT_ID_MISMATCH';
  end if;

  -- Ensure transaction is bound to the invoice tenant/invoice.
  update public.transactions
  set
    tenant_id = v_invoice.tenant_id,
    invoice_id = v_invoice.id,
    recorded_at = coalesce(recorded_at, now())
  where id = p_transaction_id;

  -- Set invoice provider pointer if absent (immutability trigger allows first set only).
  if v_invoice.provider_payment_id is null and v_tx.provider_reference is not null then
    update public.invoices
    set provider_payment_id = v_tx.provider_reference,
        provider_payment_status = coalesce(provider_payment_status, 'succeeded'),
        updated_at = now()
    where id = v_invoice.id;
  end if;

  -- Application idempotency: at most one application per transaction/invoice.
  select id
    into v_existing_app
    from public.transaction_applications
   where transaction_id = p_transaction_id
     and invoice_id = v_invoice.id
   limit 1;

  if v_existing_app is null then
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
      p_transaction_id,
      v_invoice.id,
      v_tx.amount,
      'payment',
      p_actor_user_id,
      jsonb_build_object('reconciled', true, 'note', p_note)
    )
    returning id into v_app_id;
    v_effect_created := true;
  else
    v_app_id := v_existing_app;
    v_effect_created := false;
  end if;

  perform public.recalculate_invoice_settlement(v_invoice.id);

  update public.invoices
  set reconciliation_required = false,
      reconciliation_reason = null,
      updated_at = now()
  where id = v_invoice.id;

  update public.stripe_webhook_events
  set invoice_id = v_invoice.id,
      processed_status = 'processed_reconciled',
      processed_at = now(),
      reconciliation_required = false,
      quarantine_reason = null
  where resolved_transaction_id = p_transaction_id;

  -- Optional event emission: emit canonical events if missing (DB-level dedupe indexes protect duplicates).
  select exists(
    select 1 from public.events
    where entity_type = 'payment'
      and entity_id = v_invoice.id
      and event_type = 'PaymentSucceeded'
    limit 1
  ) into v_has_payment_succeeded_event;

  if not v_has_payment_succeeded_event then
    begin
      insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
      values (
        v_invoice.tenant_id,
        'payment',
        v_invoice.id,
        'PaymentSucceeded',
        'reconciliation',
        p_actor_user_id,
        jsonb_build_object('transaction_id', p_transaction_id, 'invoice_id', v_invoice.id, 'note', p_note)
      );
    exception when unique_violation then
      -- deduped
    end;
  end if;

  select exists(
    select 1 from public.events
    where entity_type = 'invoice'
      and entity_id = v_invoice.id
      and event_type = 'InvoicePaid'
    limit 1
  ) into v_has_invoice_paid_event;

  if not v_has_invoice_paid_event then
    begin
      insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
      values (
        v_invoice.tenant_id,
        'invoice',
        v_invoice.id,
        'InvoicePaid',
        'reconciliation',
        p_actor_user_id,
        jsonb_build_object('transaction_id', p_transaction_id, 'invoice_id', v_invoice.id, 'note', p_note)
      );
    exception when unique_violation then
      -- deduped
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', (not v_effect_created),
    'financial_effect_created', v_effect_created,
    'transaction_id', p_transaction_id,
    'invoice_id', v_invoice.id,
    'transaction_application_id', v_app_id
  );
end;
$$;

revoke execute on function public.reconcile_apply_webhook_transaction_to_invoice(uuid, uuid, uuid, text) from public;
grant execute on function public.reconcile_apply_webhook_transaction_to_invoice(uuid, uuid, uuid, text) to service_role;

-- ----------------------------
-- Resolve: capture legacy invoice amount_paid into ledger as opening balance
-- ----------------------------

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
    coalesce(nullif(lower(btrim(v_invoice.currency)), ''), 'usd'),
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

revoke execute on function public.reconcile_capture_legacy_invoice_opening_balance(uuid, uuid, text) from public;
grant execute on function public.reconcile_capture_legacy_invoice_opening_balance(uuid, uuid, text) to service_role;

