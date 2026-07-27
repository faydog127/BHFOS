-- Public payment money-integrity hardening.
-- This migration is intentionally additive: the existing settlement RPC remains
-- available for non-public payment paths while public attempts receive an atomic
-- current-state validation before any invoice application is created.

alter table public.public_payment_attempts
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists checkout_generation bigint not null default 0,
  add column if not exists public_origin_key text;

create unique index if not exists public_payment_attempts_public_origin_key_uniq
  on public.public_payment_attempts (public_origin_key)
  where public_origin_key is not null;

alter table public.invoices
  add column if not exists checkout_generation bigint not null default 0,
  add column if not exists checkout_mutation_pending boolean not null default false,
  add column if not exists checkout_mutation_started_at timestamptz;

alter table public.public_payment_attempts enable row level security;
revoke all on table public.public_payment_attempts from anon, authenticated;
grant all on table public.public_payment_attempts to service_role;

create or replace function public.begin_invoice_checkout_mutation(
  p_tenant_id text,
  p_invoice_id uuid,
  p_expected_generation bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_generation bigint;
begin
  update public.invoices
     set checkout_generation = checkout_generation + 1,
         checkout_mutation_pending = true,
         checkout_mutation_started_at = now()
   where id = p_invoice_id
     and tenant_id = p_tenant_id
     and checkout_generation = p_expected_generation
     and (
       checkout_mutation_pending = false
       or checkout_mutation_started_at < now() - interval '10 minutes'
     )
  returning checkout_generation into v_generation;

  if v_generation is null then
    raise exception 'CHECKOUT_MUTATION_FENCE_UNAVAILABLE';
  end if;
  return v_generation;
end;
$$;

create or replace function public.finish_invoice_checkout_mutation(
  p_tenant_id text,
  p_invoice_id uuid,
  p_checkout_generation bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finished boolean := false;
begin
  update public.invoices
     set checkout_mutation_pending = false,
         checkout_mutation_started_at = null
   where id = p_invoice_id
     and tenant_id = p_tenant_id
     and checkout_generation = p_checkout_generation
     and checkout_mutation_pending = true;
  v_finished := found;
  return v_finished;
end;
$$;

create or replace function public.abort_invoice_checkout_mutation(
  p_tenant_id text,
  p_invoice_id uuid,
  p_checkout_generation bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aborted boolean := false;
begin
  update public.invoices
     set checkout_generation = checkout_generation - 1,
         checkout_mutation_pending = false,
         checkout_mutation_started_at = null
   where id = p_invoice_id
     and tenant_id = p_tenant_id
     and checkout_generation = p_checkout_generation
     and checkout_mutation_pending = true;
  v_aborted := found;
  return v_aborted;
end;
$$;

create or replace function public.register_public_checkout_attempt(
  p_tenant_id text,
  p_invoice_id uuid,
  p_public_token uuid,
  p_public_origin_key text,
  p_expected_generation bigint,
  p_amount_cents bigint,
  p_method text,
  p_currency text,
  p_idempotency_key text,
  p_checkout_session_id text,
  p_checkout_url text,
  p_checkout_expires_at timestamptz,
  p_provider_payment_id text,
  p_run_id text,
  p_client_ip text,
  p_user_agent text
)
returns table (ok boolean, reason text, attempt_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_attempt_id uuid;
  v_total_cents bigint;
  v_paid_cents bigint;
  v_balance_cents bigint;
  v_existing_attempt public.public_payment_attempts%rowtype;
begin
  if p_public_origin_key is null or btrim(p_public_origin_key) = '' then
    raise exception 'PUBLIC_ORIGIN_KEY_REQUIRED';
  end if;
  if p_checkout_session_id is null or btrim(p_checkout_session_id) = '' then
    raise exception 'CHECKOUT_SESSION_ID_REQUIRED';
  end if;
  if p_provider_payment_id is null or btrim(p_provider_payment_id) = '' then
    raise exception 'PROVIDER_PAYMENT_ID_REQUIRED';
  end if;
  if p_method is null or btrim(p_method) = '' or p_currency is null or btrim(p_currency) = '' then
    raise exception 'PAYMENT_METHOD_OR_CURRENCY_REQUIRED';
  end if;
  if p_checkout_url is null or btrim(p_checkout_url) = '' then
    raise exception 'CHECKOUT_URL_REQUIRED';
  end if;

  select i.*
    into v_invoice
    from public.invoices i
   where i.id = p_invoice_id
     and i.tenant_id = p_tenant_id
     and i.public_token = p_public_token
   for update;

  if not found then
    return query select false, 'INVOICE_NOT_FOUND', null::uuid;
    return;
  end if;

  v_total_cents := round(coalesce(v_invoice.total_amount, 0) * 100)::bigint;
  v_paid_cents := round(coalesce(v_invoice.amount_paid, 0) * 100)::bigint;
  v_balance_cents := round(coalesce(v_invoice.balance_due, 0) * 100)::bigint;

  if v_invoice.checkout_mutation_pending then
    return query select false, 'MUTATION_PENDING', null::uuid;
    return;
  elsif v_invoice.checkout_generation <> p_expected_generation then
    return query select false, 'GENERATION_CHANGED', null::uuid;
    return;
  elsif lower(coalesce(v_invoice.settlement_status, '')) = 'paid'
     or v_invoice.paid_at is not null then
    return query select false, 'INVOICE_TERMINAL', null::uuid;
    return;
  elsif lower(coalesce(v_invoice.status, '')) not in ('sent', 'partial', 'partially_paid', 'overdue', 'accepted', 'approved', 'unpaid') then
    return query select false, 'INVOICE_NOT_PAYABLE', null::uuid;
    return;
  elsif v_invoice.total_amount is null or v_invoice.amount_paid is null or v_invoice.balance_due is null
     or v_total_cents < 0 or v_paid_cents < 0 or v_balance_cents <= 0
     or (v_paid_cents <= v_total_cents and v_balance_cents <> v_total_cents - v_paid_cents)
     or (v_paid_cents > v_total_cents and v_balance_cents > 0) then
    return query select false, 'INVOICE_MONEY_STATE_CHANGED', null::uuid;
    return;
  elsif v_balance_cents <> p_amount_cents then
    return query select false, 'BALANCE_CHANGED', null::uuid;
    return;
  end if;

  select a.*
    into v_existing_attempt
    from public.public_payment_attempts a
   where a.invoice_id = p_invoice_id
     and a.tenant_id = p_tenant_id
     and lower(a.attempt_status) in ('initiated', 'pending')
   limit 1;

  if found then
    if v_existing_attempt.idempotency_key = p_idempotency_key
       and v_existing_attempt.checkout_session_id = p_checkout_session_id
       and v_existing_attempt.provider_payment_id = p_provider_payment_id
       and v_existing_attempt.public_origin_key = p_public_origin_key
       and v_existing_attempt.checkout_generation = p_expected_generation
       and v_existing_attempt.amount_cents = p_amount_cents
       and lower(v_existing_attempt.method) = lower(p_method)
       and lower(v_existing_attempt.currency) = lower(p_currency) then
      return query select true, 'EXISTING_IDENTICAL_ATTEMPT', v_existing_attempt.id;
      return;
    end if;
    return query select false, 'ACTIVE_ATTEMPT_EXISTS', null::uuid;
    return;
  end if;

  insert into public.public_payment_attempts (
    tenant_id, invoice_id, public_token, public_origin_key, provider, method, currency,
    amount_cents, idempotency_key, checkout_session_id, checkout_url,
    checkout_expires_at, checkout_generation, provider_payment_id,
    attempt_status, run_id, client_ip, user_agent, last_seen_at, updated_at
  )
  values (
    p_tenant_id, p_invoice_id, p_public_token, p_public_origin_key, 'stripe', lower(p_method),
    lower(p_currency), p_amount_cents, p_idempotency_key,
    p_checkout_session_id, p_checkout_url, p_checkout_expires_at,
    p_expected_generation, p_provider_payment_id, 'initiated', p_run_id,
    p_client_ip, p_user_agent, now(), now()
  )
  on conflict (invoice_id, idempotency_key) do nothing
  returning id into v_attempt_id;

  if v_attempt_id is null then
    return query select false, 'IDEMPOTENCY_KEY_REUSED', null::uuid;
    return;
  end if;

  update public.invoices
     set provider_payment_id = case
           when p_provider_payment_id like 'checkout_session:%' then provider_payment_id
           else p_provider_payment_id
         end,
         provider_payment_status = 'initiated',
         updated_at = now()
   where id = p_invoice_id
     and tenant_id = p_tenant_id;

  return query select true, null::text, v_attempt_id;
end;
$$;

revoke all on function public.begin_invoice_checkout_mutation(text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.finish_invoice_checkout_mutation(text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.abort_invoice_checkout_mutation(text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.register_public_checkout_attempt(
  text, uuid, uuid, text, bigint, bigint, text, text, text, text, text, timestamptz, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.begin_invoice_checkout_mutation(text, uuid, bigint) to service_role;
grant execute on function public.finish_invoice_checkout_mutation(text, uuid, bigint) to service_role;
grant execute on function public.abort_invoice_checkout_mutation(text, uuid, bigint) to service_role;
grant execute on function public.register_public_checkout_attempt(
  text, uuid, uuid, text, bigint, bigint, text, text, text, text, text, timestamptz, text, text, text, text
) to service_role;

create or replace function public.record_offline_manual_payment_fenced(
  p_tenant_id text,
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_manual_reference_raw text,
  p_actor_user_id uuid,
  p_request_id text,
  p_checkout_generation bigint
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
  v_invoice_id uuid;
begin
  select i.id
    into v_invoice_id
    from public.invoices i
   where i.id = p_invoice_id
     and i.tenant_id = p_tenant_id
     and i.checkout_generation = p_checkout_generation
     and i.checkout_mutation_pending = true
   for update;

  if v_invoice_id is null then
    raise exception 'CHECKOUT_MUTATION_FENCE_OWNERSHIP_LOST';
  end if;

  return query
    select *
      from public.record_offline_manual_payment(
        p_tenant_id,
        p_invoice_id,
        p_amount,
        p_payment_method,
        p_manual_reference_raw,
        p_actor_user_id,
        p_request_id
      );
end;
$$;

revoke all on function public.record_offline_manual_payment_fenced(
  text, uuid, numeric, text, text, uuid, text, bigint
) from public, anon, authenticated;
grant execute on function public.record_offline_manual_payment_fenced(
  text, uuid, numeric, text, text, uuid, text, bigint
) to service_role;

create or replace function public.replace_invoice_items_fenced(
  p_tenant_id text,
  p_invoice_id uuid,
  p_checkout_generation bigint,
  p_items jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  select i.id
    into v_invoice_id
    from public.invoices i
   where i.id = p_invoice_id
     and i.tenant_id = p_tenant_id
     and i.checkout_generation = p_checkout_generation
     and i.checkout_mutation_pending = true
   for update;

  if v_invoice_id is null then
    raise exception 'CHECKOUT_MUTATION_FENCE_OWNERSHIP_LOST';
  end if;

  delete from public.invoice_items where invoice_id = p_invoice_id;

  insert into public.invoice_items (
    invoice_id, description, quantity, unit_price, total_price
  )
  select
    p_invoice_id, item.description, item.quantity, item.unit_price, item.total_price
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    description text,
    quantity numeric,
    unit_price numeric,
    total_price numeric
  );

  return true;
end;
$$;

revoke all on function public.replace_invoice_items_fenced(
  text, uuid, bigint, jsonb
) from public, anon, authenticated;
grant execute on function public.replace_invoice_items_fenced(
  text, uuid, bigint, jsonb
) to service_role;

alter function public.record_stripe_webhook_payment(
  text, text, text, bigint, text, jsonb, uuid
) rename to record_stripe_webhook_payment_legacy_unvalidated;

create or replace function public.record_stripe_webhook_payment_validated(
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
  v_attempt public.public_payment_attempts%rowtype;
  v_invoice public.invoices%rowtype;
  v_reason text := null;
  v_event_inserted text;
  v_tx_id uuid;
  v_tx_inserted boolean := false;
  v_amount numeric;
  v_invoice_found boolean := false;
  v_existing_tx_id uuid;
  v_existing_tx_amount numeric;
  v_existing_tx_currency text;
  v_result record;
  v_public_origin boolean := false;
  v_public_origin_key text := null;
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

  v_public_origin :=
    lower(coalesce(p_payload #>> '{data,object,metadata,payment_origin}', '')) = 'public_pay';
  v_public_origin_key :=
    nullif(btrim(coalesce(p_payload #>> '{data,object,metadata,public_origin_key}', '')), '');

  select a.*
    into v_attempt
    from public.public_payment_attempts a
   where a.provider_payment_id = p_provider_payment_id
      or (
        v_public_origin_key is not null
        and a.public_origin_key::text = v_public_origin_key
      )
   limit 1
   for update;

  if not found then
    if v_public_origin then
      insert into public.stripe_webhook_events (
        event_id, event_type, payment_intent_id, provider_payment_id, payload,
        processed_status, processed_at, invoice_id, reconciliation_required,
        quarantine_reason, received_at
      )
      values (
        p_gateway_event_id, p_event_type, p_provider_payment_id,
        p_provider_payment_id, p_payload, 'quarantined_missing_public_attempt',
        now(), p_invoice_id, true, 'PUBLIC_PAY_ATTEMPT_MISSING', now()
      )
      on conflict (event_id) do nothing
      returning event_id into v_event_inserted;

      return query select
        true, v_event_inserted is null, false, false, true, true,
        'PUBLIC_PAY_ATTEMPT_MISSING'::text, null::uuid, p_invoice_id;
      return;
    end if;

    -- Preserve the established path only for provider payments that are not
    -- marked as originating from public checkout.
    return query
      select *
        from public.record_stripe_webhook_payment_legacy_unvalidated(
          p_gateway_event_id,
          p_event_type,
          p_provider_payment_id,
          p_amount_cents,
          p_currency,
          p_payload,
          p_invoice_id
        );
    return;
  end if;

  if v_public_origin then
    if v_public_origin_key is null
       or v_attempt.public_origin_key::text <> v_public_origin_key then
      v_reason := 'PUBLIC_PAY_ORIGIN_KEY_MISMATCH';
    elsif v_attempt.provider_payment_id like 'checkout_session:%' then
      update public.public_payment_attempts
         set provider_payment_id = p_provider_payment_id,
             updated_at = now()
       where id = v_attempt.id
         and provider_payment_id = v_attempt.provider_payment_id;
      v_attempt.provider_payment_id := p_provider_payment_id;
    elsif v_attempt.provider_payment_id <> p_provider_payment_id then
      v_reason := 'PUBLIC_PAY_PROVIDER_PAYMENT_MISMATCH';
    end if;
  end if;

  select i.*
    into v_invoice
    from public.invoices i
   where i.id = v_attempt.invoice_id
     and i.tenant_id is not distinct from v_attempt.tenant_id
   for update;
  v_invoice_found := found;

  -- Do not turn a payment racing checkout invalidation into a permanent
  -- reconciliation case. The webhook caller must retry after the mutation
  -- either commits or aborts.
  if v_invoice_found and v_invoice.checkout_mutation_pending then
    raise exception 'PUBLIC_PAY_INVOICE_MUTATION_PENDING_RETRY';
  end if;

  if lower(coalesce(v_attempt.attempt_status, '')) not in ('initiated', 'pending', 'succeeded') then
    v_reason := 'PUBLIC_PAY_ATTEMPT_NOT_ACTIVE';
  elsif not v_invoice_found then
    v_reason := 'PUBLIC_PAY_INVOICE_NOT_FOUND';
  elsif lower(coalesce(v_invoice.settlement_status, '')) = 'paid'
     or v_invoice.paid_at is not null then
    v_reason := 'PUBLIC_PAY_INVOICE_TERMINAL';
  elsif v_invoice.checkout_generation <> v_attempt.checkout_generation then
    v_reason := 'PUBLIC_PAY_CHECKOUT_GENERATION_STALE';
  elsif p_invoice_id is not null and p_invoice_id <> v_attempt.invoice_id then
    v_reason := 'PUBLIC_PAY_INVOICE_MISMATCH';
  elsif lower(coalesce(v_attempt.currency, '')) <> lower(coalesce(p_currency, '')) then
    v_reason := 'PUBLIC_PAY_CURRENCY_MISMATCH';
  elsif v_attempt.amount_cents <> p_amount_cents then
    v_reason := 'PUBLIC_PAY_CAPTURE_AMOUNT_MISMATCH';
  elsif v_invoice.total_amount is null
     or v_invoice.amount_paid is null
     or v_invoice.balance_due is null
     or round(coalesce(v_invoice.total_amount, 0) * 100)::bigint < 0
     or round(coalesce(v_invoice.amount_paid, 0) * 100)::bigint < 0
     or round(coalesce(v_invoice.balance_due, 0) * 100)::bigint < 0
     or (
       round(coalesce(v_invoice.amount_paid, 0) * 100)::bigint
         <= round(coalesce(v_invoice.total_amount, 0) * 100)::bigint
       and round(coalesce(v_invoice.balance_due, 0) * 100)::bigint
         <> round(coalesce(v_invoice.total_amount - v_invoice.amount_paid, 0) * 100)::bigint
     )
     or (
       round(coalesce(v_invoice.amount_paid, 0) * 100)::bigint
         > round(coalesce(v_invoice.total_amount, 0) * 100)::bigint
       and round(coalesce(v_invoice.balance_due, 0) * 100)::bigint > 0
     ) then
    v_reason := 'PUBLIC_PAY_INVOICE_MONEY_STATE_INVALID';
  elsif lower(coalesce(v_invoice.status, '')) in ('paid', 'void', 'voided', 'cancelled', 'canceled') then
    v_reason := 'PUBLIC_PAY_INVOICE_TERMINAL';
  elsif lower(coalesce(v_invoice.status, '')) not in ('sent', 'partial', 'partially_paid', 'overdue', 'accepted', 'approved', 'unpaid') then
    v_reason := 'PUBLIC_PAY_INVOICE_NOT_PAYABLE';
  elsif round(coalesce(v_invoice.balance_due, 0) * 100)::bigint <> v_attempt.amount_cents then
    v_reason := 'PUBLIC_PAY_BALANCE_CHANGED';
  end if;

  -- A captured transaction without an application is quarantined money truth.
  -- It must never re-enter the legacy function on replay, even if invoice state
  -- later happens to match. An already-applied transaction can use the existing
  -- duplicate-payment path safely.
  select t.id, t.amount, t.currency
    into v_existing_tx_id, v_existing_tx_amount, v_existing_tx_currency
    from public.transactions t
   where t.source = 'webhook'
     and t.provider_reference = p_provider_payment_id
   limit 1;

  if v_existing_tx_id is not null and exists (
    select 1
      from public.transaction_applications ta
     where ta.transaction_id = v_existing_tx_id
       and ta.invoice_id = v_attempt.invoice_id
  ) then
    if p_invoice_id is not null and p_invoice_id <> v_attempt.invoice_id then
      v_reason := 'PUBLIC_PAY_REPLAY_INVOICE_MISMATCH';
    elsif round(v_existing_tx_amount * 100)::bigint <> p_amount_cents then
      v_reason := 'PUBLIC_PAY_REPLAY_CAPTURE_AMOUNT_MISMATCH';
    elsif lower(coalesce(v_existing_tx_currency, '')) <> lower(coalesce(p_currency, '')) then
      v_reason := 'PUBLIC_PAY_REPLAY_CURRENCY_MISMATCH';
    else
      select *
        into v_result
        from public.record_stripe_webhook_payment_legacy_unvalidated(
          p_gateway_event_id,
          p_event_type,
          p_provider_payment_id,
          p_amount_cents,
          p_currency,
          p_payload,
          v_attempt.invoice_id
        );
      if not coalesce(v_result.reconciliation_required, false) and not coalesce(v_result.quarantined, false) then
        update public.public_payment_attempts
           set attempt_status = 'succeeded',
               checkout_url = null,
               checkout_expires_at = null,
               updated_at = now()
         where id = v_attempt.id;
        if coalesce(v_result.financial_effect_created, false) then
          update public.invoices
             set checkout_generation = checkout_generation + 1,
                 updated_at = now()
           where id = v_attempt.invoice_id
             and tenant_id is not distinct from v_attempt.tenant_id;
        end if;
      end if;
      select v_result.ok, v_result.duplicate_event, v_result.duplicate_payment,
             v_result.financial_effect_created, v_result.reconciliation_required,
             v_result.quarantined, v_result.quarantine_reason, v_result.transaction_id,
             v_result.invoice_id
        into ok, duplicate_event, duplicate_payment, financial_effect_created,
             reconciliation_required, quarantined, quarantine_reason, transaction_id,
             invoice_id;
      return next;
      return;
    end if;
  elsif v_existing_tx_id is not null then
    select coalesce(e.quarantine_reason, v_reason, 'PUBLIC_PAY_EXISTING_UNAPPLIED_CAPTURE')
      into v_reason
      from public.stripe_webhook_events e
     where e.provider_payment_id = p_provider_payment_id
       and e.reconciliation_required = true
     order by e.received_at desc
     limit 1;
    v_reason := coalesce(v_reason, 'PUBLIC_PAY_EXISTING_UNAPPLIED_CAPTURE');
  end if;

  if v_reason is null then
    select *
      into v_result
      from public.record_stripe_webhook_payment_legacy_unvalidated(
        p_gateway_event_id,
        p_event_type,
        p_provider_payment_id,
        p_amount_cents,
        p_currency,
        p_payload,
        v_attempt.invoice_id
      );
    if not coalesce(v_result.reconciliation_required, false) and not coalesce(v_result.quarantined, false) then
      update public.public_payment_attempts
         set attempt_status = 'succeeded',
             checkout_url = null,
             checkout_expires_at = null,
             updated_at = now()
       where id = v_attempt.id;
      if coalesce(v_result.financial_effect_created, false) then
        update public.invoices
           set checkout_generation = checkout_generation + 1,
               updated_at = now()
         where id = v_attempt.invoice_id
           and tenant_id is not distinct from v_attempt.tenant_id;
      end if;
    end if;
    select v_result.ok, v_result.duplicate_event, v_result.duplicate_payment,
           v_result.financial_effect_created, v_result.reconciliation_required,
           v_result.quarantined, v_result.quarantine_reason, v_result.transaction_id,
           v_result.invoice_id
      into ok, duplicate_event, duplicate_payment, financial_effect_created,
           reconciliation_required, quarantined, quarantine_reason, transaction_id,
           invoice_id;
    return next;
    return;
  end if;

  v_amount := p_amount_cents::numeric / 100;

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
  on conflict (event_id) do nothing
  returning event_id into v_event_inserted;

  duplicate_event := v_event_inserted is null;

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
    v_attempt.tenant_id,
    v_attempt.invoice_id,
    v_amount,
    'stripe',
    'succeeded',
    now(),
    'webhook',
    lower(coalesce(nullif(btrim(p_currency), ''), 'usd')),
    p_provider_payment_id,
    format('stripe:%s', p_provider_payment_id),
    now()
  )
  on conflict (provider_reference) where source = 'webhook' and provider_reference is not null
  do update set recorded_at = excluded.recorded_at
  returning id, (xmax = 0) into v_tx_id, v_tx_inserted;

  update public.stripe_webhook_events
     set processed_at = now(),
         processed_status = 'quarantined_stale_checkout',
         invoice_id = v_attempt.invoice_id,
         provider_payment_id = p_provider_payment_id,
         resolved_transaction_id = v_tx_id,
         reconciliation_required = true,
         quarantine_reason = v_reason
   where event_id = p_gateway_event_id
     and v_event_inserted is not null;

  update public.public_payment_attempts
     set attempt_status = 'needs_reconciliation',
         updated_at = now()
   where id = v_attempt.id;

  if v_invoice.id is not null then
    update public.invoices
       set reconciliation_required = true,
           reconciliation_reason = coalesce(reconciliation_reason, v_reason),
           updated_at = now()
     where id = v_invoice.id;
  end if;

  ok := true;
  duplicate_payment := not v_tx_inserted;
  financial_effect_created := false;
  reconciliation_required := true;
  quarantined := true;
  quarantine_reason := v_reason;
  transaction_id := v_tx_id;
  invoice_id := v_attempt.invoice_id;
  return next;
end;
$$;

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
language sql
security definer
set search_path = public
as $$
  select *
    from public.record_stripe_webhook_payment_validated(
      p_gateway_event_id,
      p_event_type,
      p_provider_payment_id,
      p_amount_cents,
      p_currency,
      p_payload,
      p_invoice_id
    );
$$;

revoke all on function public.record_stripe_webhook_payment_legacy_unvalidated(
  text, text, text, bigint, text, jsonb, uuid
) from public, anon, authenticated, service_role;

revoke all on function public.record_stripe_webhook_payment(
  text, text, text, bigint, text, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.record_stripe_webhook_payment(
  text, text, text, bigint, text, jsonb, uuid
) to service_role;

revoke all on function public.record_stripe_webhook_payment_validated(
  text, text, text, bigint, text, jsonb, uuid
) from public;

grant execute on function public.record_stripe_webhook_payment_validated(
  text, text, text, bigint, text, jsonb, uuid
) to service_role;
