-- P0-02.E — Payment reconciliation sweeper (local-proof harness)
--
-- Principle: detective + recovery router; not a second settlement engine.
-- - Drift detection flags only (no ad hoc math fixes).
-- - Recovery uses canonical webhook settlement RPC (`record_stripe_webhook_payment`).

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

create unique index if not exists provider_payment_observations_dedupe_uq
  on public.provider_payment_observations (provider, provider_payment_id, status, observed_at);

-- Sweeper: checks cold attempts + quarantines + drift and returns summary.
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
  v_drift_rows int := 0;

  r_attempt record;
  r_obs record;
  r_result record;

  v_event_id text;
  v_actor uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_tx_id uuid;
begin
  -- 1) Dropped webhook recovery / ghost attempt closure
  for r_attempt in
    select a.*
    from public.public_payment_attempts a
    join public.invoices i on i.id = a.invoice_id
    where a.provider = 'stripe'
      and a.provider_payment_id is not null
      and lower(coalesce(a.attempt_status,'')) in ('initiated','pending')
      and a.created_at < v_cutoff
      and i.created_at < now() -- placeholder; keep simple
      and lower(coalesce(i.status,'')) <> 'paid'
      and coalesce(i.balance_due, 0) > 0
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
      set attempt_status = lower(r_obs.status),
          updated_at = now()
      where id = r_attempt.id;

      -- Operational trace (dedupe by payload checkout_session_id index if present).
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
        -- ignore
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
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'status', lower(r_obs.status))
      );

      v_closed := v_closed + 1;
      continue;
    end if;

    if lower(r_obs.status) <> 'succeeded' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if r_obs.amount_cents is null or r_obs.amount_cents <= 0 then
      perform public.ensure_follow_up_task(
        r_attempt.tenant_id,
        'invoice',
        r_attempt.invoice_id,
        null,
        'Payment Observation Missing Amount – Review',
        null,
        'high',
        null,
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id)
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

      perform public.ensure_follow_up_task(
        r_attempt.tenant_id,
        'invoice',
        r_attempt.invoice_id,
        null,
        'Payment Reconciliation Required',
        null,
        'high',
        null,
        jsonb_build_object('provider_payment_id', r_attempt.provider_payment_id, 'quarantine_reason', r_result.quarantine_reason)
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

  -- 2) Quarantine surfacing (no application/settlement changes)
  for r_attempt in
    select e.*
    from public.stripe_webhook_events e
    where coalesce(e.reconciliation_required,false) = true
      and e.received_at < v_cutoff
    order by e.received_at asc
    limit 200
  loop
    perform public.ensure_follow_up_task(
      null,
      'webhook',
      coalesce(r_attempt.resolved_transaction_id, gen_random_uuid()),
      null,
      'Payment Webhook Quarantined – Triage',
      null,
      'high',
      null,
      jsonb_build_object('gateway_event_id', r_attempt.event_id, 'quarantine_reason', r_attempt.quarantine_reason)
    );
  end loop;

  -- 3) Drift detection (flag only; do not recompute)
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
  update public.invoices i
  set reconciliation_required = true,
      reconciliation_reason = 'SETTLEMENT_DRIFT',
      updated_at = now()
  from app_sums s
  where i.id = s.invoice_id
    and i.tenant_id is not distinct from s.tenant_id
    and (
      abs(coalesce(i.amount_paid,0) - s.applied_paid) > 0.009
      or abs(coalesce(i.balance_due,0) - greatest(coalesce(i.total_amount,0) - s.applied_paid,0)) > 0.009
    );

  get diagnostics v_drift_rows = row_count;
  v_flagged := v_flagged + v_drift_rows;

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
