-- P0-02.E — Payment reconciliation sweeper (convergence-grade)
--
-- Goals:
-- - Detective + recovery router (never a second settlement engine).
-- - Recovery routes through canonical webhook settlement RPC (`record_stripe_webhook_payment`).
-- - Drift detection compares invoice projections vs settlement-eligible applications (flag/alert only).
-- - Anomaly latch: deterministic alert identity (no operator spam).
-- - Local-proof harness: provider truth is simulated via `provider_payment_observations`.

create extension if not exists pgcrypto;

-- -----------------------------------------
-- Anomaly latch (deterministic alert record)
-- -----------------------------------------

create table if not exists public.reconciliation_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  tenant_id text,
  invoice_id uuid,
  provider text not null default 'stripe',
  provider_payment_id text,
  gateway_event_id text,
  anomaly_type text not null,
  severity text not null default 'high',
  status text not null default 'open',
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create unique index if not exists reconciliation_alerts_alert_key_uq
  on public.reconciliation_alerts (alert_key);

create index if not exists reconciliation_alerts_tenant_idx
  on public.reconciliation_alerts (tenant_id, last_detected_at desc);

create index if not exists reconciliation_alerts_invoice_idx
  on public.reconciliation_alerts (invoice_id, last_detected_at desc);

create index if not exists reconciliation_alerts_provider_payment_idx
  on public.reconciliation_alerts (provider_payment_id, last_detected_at desc);

create or replace function public.ensure_reconciliation_alert(
  p_alert_key text,
  p_tenant_id text,
  p_invoice_id uuid,
  p_anomaly_type text,
  p_severity text default 'high',
  p_payload jsonb default '{}'::jsonb,
  p_provider_payment_id text default null,
  p_gateway_event_id text default null,
  p_provider text default 'stripe'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_alert_key is null or btrim(p_alert_key) = '' then
    raise exception 'ALERT_KEY_REQUIRED';
  end if;
  if p_anomaly_type is null or btrim(p_anomaly_type) = '' then
    raise exception 'ANOMALY_TYPE_REQUIRED';
  end if;

  insert into public.reconciliation_alerts (
    alert_key,
    tenant_id,
    invoice_id,
    provider,
    provider_payment_id,
    gateway_event_id,
    anomaly_type,
    severity,
    status,
    first_detected_at,
    last_detected_at,
    payload
  )
  values (
    p_alert_key,
    p_tenant_id,
    p_invoice_id,
    coalesce(nullif(lower(btrim(p_provider)), ''), 'stripe'),
    nullif(btrim(p_provider_payment_id), ''),
    nullif(btrim(p_gateway_event_id), ''),
    p_anomaly_type,
    coalesce(nullif(lower(btrim(p_severity)), ''), 'high'),
    'open',
    now(),
    now(),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (alert_key) do update
    set last_detected_at = now(),
        severity = excluded.severity,
        status = case when public.reconciliation_alerts.status = 'resolved' then 'open' else public.reconciliation_alerts.status end,
        payload = public.reconciliation_alerts.payload || excluded.payload
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.ensure_reconciliation_alert(text, text, uuid, text, text, jsonb, text, text, text) from public;
grant execute on function public.ensure_reconciliation_alert(text, text, uuid, text, text, jsonb, text, text, text) to service_role;

-- -----------------------------------------
-- Local provider truth harness (for tests)
-- -----------------------------------------

create table if not exists public.provider_payment_observations (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_payment_id text not null,
  status text not null, -- succeeded|failed|canceled|expired|unknown
  amount_cents bigint,
  currency text default 'usd',
  observed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists provider_payment_observations_provider_id_idx
  on public.provider_payment_observations (provider, provider_payment_id, observed_at desc);

-- best-effort dedupe identity for local proofs
create unique index if not exists provider_payment_observations_dedupe_uq
  on public.provider_payment_observations (provider, provider_payment_id, status, observed_at);

-- -----------------------------------------
-- Event spam guard (operational trace)
-- -----------------------------------------

create unique index if not exists ux_events_payment_attempt_closed_attempt_id
  on public.events ((payload->>'attempt_id'))
  where event_type = 'PaymentAttemptClosed' and (payload->>'attempt_id') is not null;

-- -----------------------------------------
-- Sweeper
-- -----------------------------------------

create or replace function public.p0_02e_run_sweep(
  p_min_age_minutes integer default 60,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - (coalesce(p_min_age_minutes, 60) || ' minutes')::interval;
  v_processed int := 0;
  v_recovered int := 0;
  v_closed int := 0;
  v_flagged int := 0;
  v_skipped int := 0;

  r_attempt record;
  r_obs record;
  r_wh record;
  r_drift record;
  r_result record;

  v_event_id text;
  v_actor uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_tx_id uuid;
  v_alert_key text;
  v_invoice_tenant text;
begin
  -- 1) Dropped webhook recovery / ghost attempt closure (cold attempts only)
  for r_attempt in
    select a.*, i.status as invoice_status, i.balance_due as invoice_balance_due
    from public.public_payment_attempts a
    join public.invoices i on i.id = a.invoice_id
    where a.provider = 'stripe'
      and a.provider_payment_id is not null
      and lower(coalesce(a.attempt_status,'')) in ('initiated','pending')
      and a.created_at < v_cutoff
    order by a.created_at asc
    limit coalesce(p_limit, 200)
  loop
    v_processed := v_processed + 1;

    select *
    into r_obs
    from public.provider_payment_observations o
    where o.provider = 'stripe'
      and o.provider_payment_id = r_attempt.provider_payment_id
    order by o.observed_at desc
    limit 1;

    if not found then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if lower(r_obs.status) in ('failed','canceled','cancelled','expired') then
      update public.public_payment_attempts
      set attempt_status = case when lower(r_obs.status) = 'cancelled' then 'canceled' else lower(r_obs.status) end,
          updated_at = now()
      where id = r_attempt.id;

      v_alert_key := format('p0_02e:ghost_intent:%s', r_attempt.id);
      perform public.ensure_reconciliation_alert(
        v_alert_key,
        r_attempt.tenant_id,
        r_attempt.invoice_id,
        'GHOST_INTENT_CLEANUP',
        'medium',
        jsonb_build_object(
          'provider_payment_id', r_attempt.provider_payment_id,
          'status', lower(r_obs.status),
          'checkout_session_id', r_attempt.checkout_session_id,
          'attempt_id', r_attempt.id
        ),
        r_attempt.provider_payment_id,
        null,
        'stripe'
      );

      begin
        insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
        values (
          r_attempt.tenant_id,
          'payment_attempt',
          r_attempt.id,
          'PaymentAttemptClosed',
          'sweep',
          v_actor,
          jsonb_build_object(
            'provider_payment_id', r_attempt.provider_payment_id,
            'status', lower(r_obs.status),
            'checkout_session_id', r_attempt.checkout_session_id,
            'attempt_id', r_attempt.id
          )
        );
      exception when unique_violation then
      end;

      perform public.ensure_follow_up_task(
        r_attempt.tenant_id,
        'invoice',
        r_attempt.invoice_id,
        null,
        'Payment Attempt Closed – Verify',
        null,
        'medium',
        null,
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'status', lower(r_obs.status), 'attempt_id', r_attempt.id)
      );

      v_closed := v_closed + 1;
      continue;
    end if;

    if lower(r_obs.status) <> 'succeeded' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if r_obs.amount_cents is null or r_obs.amount_cents <= 0 then
      v_alert_key := format('p0_02e:missing_amount:%s', r_attempt.provider_payment_id);
      perform public.ensure_reconciliation_alert(
        v_alert_key,
        r_attempt.tenant_id,
        r_attempt.invoice_id,
        'OBSERVATION_MISSING_AMOUNT',
        'high',
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'attempt_id', r_attempt.id),
        r_attempt.provider_payment_id
      );

      perform public.ensure_follow_up_task(
        r_attempt.tenant_id,
        'invoice',
        r_attempt.invoice_id,
        null,
        'Payment Observation Missing Amount – Review',
        null,
        'high',
        null,
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'attempt_id', r_attempt.id)
      );

      v_flagged := v_flagged + 1;
      continue;
    end if;

    -- Recovery must use canonical webhook settlement path.
    v_event_id := format('sweep:%s', r_attempt.provider_payment_id);

    select *
    into r_result
    from public.record_stripe_webhook_payment(
      v_event_id,
      'payment_intent.succeeded',
      r_attempt.provider_payment_id,
      r_obs.amount_cents,
      coalesce(nullif(lower(btrim(r_obs.currency)),''),'usd'),
      coalesce(r_obs.payload, jsonb_build_object('source','sweep')),
      r_attempt.invoice_id
    )
    limit 1;

    if coalesce(r_result.reconciliation_required,false) or coalesce(r_result.quarantined,false) then
      update public.public_payment_attempts
      set attempt_status = 'needs_reconciliation',
          updated_at = now()
      where id = r_attempt.id;

      v_alert_key := format('p0_02e:reconciliation_required:%s:%s', r_attempt.invoice_id, r_attempt.provider_payment_id);
      perform public.ensure_reconciliation_alert(
        v_alert_key,
        r_attempt.tenant_id,
        r_attempt.invoice_id,
        'RECOVERY_REQUIRES_RECONCILIATION',
        'high',
        jsonb_build_object(
          'provider_payment_id', r_attempt.provider_payment_id,
          'gateway_event_id', v_event_id,
          'quarantine_reason', r_result.quarantine_reason,
          'attempt_id', r_attempt.id,
          'transaction_id', r_result.transaction_id
        ),
        r_attempt.provider_payment_id,
        v_event_id
      );

      perform public.ensure_follow_up_task(
        r_attempt.tenant_id,
        'invoice',
        r_attempt.invoice_id,
        null,
        'Payment Reconciliation Required',
        null,
        'high',
        null,
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'quarantine_reason', r_result.quarantine_reason, 'attempt_id', r_attempt.id)
      );

      v_flagged := v_flagged + 1;
      continue;
    end if;

    v_tx_id := r_result.transaction_id;

    if coalesce(r_result.financial_effect_created,false) then
      -- Emit canonical events once (DB indexes dedupe by transaction_id).
      begin
        insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
        values (
          r_attempt.tenant_id,
          'payment',
          r_attempt.invoice_id,
          'PaymentSucceeded',
          'sweep',
          v_actor,
          jsonb_build_object('transaction_id', v_tx_id, 'invoice_id', r_attempt.invoice_id, 'provider_payment_id', r_attempt.provider_payment_id)
        );
      exception when unique_violation then
      end;

      begin
        insert into public.events (tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload)
        values (
          r_attempt.tenant_id,
          'invoice',
          r_attempt.invoice_id,
          'InvoicePaid',
          'sweep',
          v_actor,
          jsonb_build_object('transaction_id', v_tx_id, 'invoice_id', r_attempt.invoice_id, 'provider_payment_id', r_attempt.provider_payment_id)
        );
      exception when unique_violation then
      end;
    end if;

    update public.public_payment_attempts
    set attempt_status = 'succeeded',
        updated_at = now()
    where id = r_attempt.id;

    v_recovered := v_recovered + 1;
  end loop;

  -- 2) Quarantine surfacing (alerts only; no application/settlement changes)
  for r_wh in
    select e.event_id, e.provider_payment_id, e.invoice_id, e.quarantine_reason, e.processed_status, e.received_at
    from public.stripe_webhook_events e
    where coalesce(e.reconciliation_required,false) = true
      and e.received_at < v_cutoff
    order by e.received_at asc
    limit 200
  loop
    select tenant_id into v_invoice_tenant from public.invoices where id = r_wh.invoice_id limit 1;

    v_alert_key := format('p0_02e:webhook_quarantine:%s', r_wh.event_id);
    perform public.ensure_reconciliation_alert(
      v_alert_key,
      v_invoice_tenant,
      r_wh.invoice_id,
      'WEBHOOK_QUARANTINED',
      'high',
      jsonb_build_object(
        'gateway_event_id', r_wh.event_id,
        'provider_payment_id', r_wh.provider_payment_id,
        'quarantine_reason', coalesce(r_wh.quarantine_reason, r_wh.processed_status)
      ),
      r_wh.provider_payment_id,
      r_wh.event_id
    );

    if v_invoice_tenant is not null and r_wh.invoice_id is not null then
      perform public.ensure_follow_up_task(
        v_invoice_tenant,
        'invoice',
        r_wh.invoice_id,
        null,
        'Payment Webhook Quarantined – Triage',
        null,
        'high',
        null,
        jsonb_build_object('gateway_event_id', r_wh.event_id, 'provider_payment_id', r_wh.provider_payment_id, 'quarantine_reason', r_wh.quarantine_reason)
      );
    end if;

    v_flagged := v_flagged + 1;
  end loop;

  -- 3) Drift detection (flag + alert only; never patch invoice math)
  for r_drift in
    with app_sums as (
      select
        i.id as invoice_id,
        i.tenant_id,
        coalesce(sum(ta.applied_amount),0) as applied_paid
      from public.invoices i
      left join public.transaction_applications ta on ta.invoice_id = i.id and ta.tenant_id = i.tenant_id
      left join public.transactions t on t.id = ta.transaction_id and t.tenant_id = i.tenant_id
      where i.updated_at < v_cutoff
        and lower(coalesce(t.status,'')) in ('succeeded','paid','success')
      group by i.id, i.tenant_id
    )
    select
      i.id as invoice_id,
      i.tenant_id,
      i.total_amount,
      i.amount_paid as invoice_amount_paid,
      i.balance_due as invoice_balance_due,
      s.applied_paid as settlement_applied_paid
    from public.invoices i
    join app_sums s on s.invoice_id = i.id and i.tenant_id is not distinct from s.tenant_id
    where (
      abs(coalesce(i.amount_paid,0) - s.applied_paid) > 0.009
      or abs(coalesce(i.balance_due,0) - greatest(coalesce(i.total_amount,0) - s.applied_paid,0)) > 0.009
    )
    limit 200
  loop
    update public.invoices
    set reconciliation_required = true,
        reconciliation_reason = 'SETTLEMENT_DRIFT',
        updated_at = now()
    where id = r_drift.invoice_id;

    v_alert_key := format('p0_02e:settlement_drift:%s', r_drift.invoice_id);
    perform public.ensure_reconciliation_alert(
      v_alert_key,
      r_drift.tenant_id,
      r_drift.invoice_id,
      'SETTLEMENT_DRIFT',
      'high',
      jsonb_build_object(
        'invoice_amount_paid', r_drift.invoice_amount_paid,
        'invoice_balance_due', r_drift.invoice_balance_due,
        'settlement_applied_paid', r_drift.settlement_applied_paid,
        'total_amount', r_drift.total_amount
      )
    );

    if r_drift.tenant_id is not null then
      perform public.ensure_follow_up_task(
        r_drift.tenant_id,
        'invoice',
        r_drift.invoice_id,
        null,
        'Settlement Drift Detected – Review',
        null,
        'high',
        null,
        jsonb_build_object('invoice_id', r_drift.invoice_id)
      );
    end if;

    v_flagged := v_flagged + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'processed_attempts', v_processed,
    'recovered', v_recovered,
    'closed', v_closed,
    'flagged', v_flagged,
    'skipped', v_skipped
  );
end;
$$;

revoke execute on function public.p0_02e_run_sweep(integer, integer) from public;
grant execute on function public.p0_02e_run_sweep(integer, integer) to service_role;

