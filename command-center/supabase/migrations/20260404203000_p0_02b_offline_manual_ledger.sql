-- P0-02.B — Offline/Manual Payment Writer Rebuild (minimum ledger surfaces)
-- Scope: manual/offline writer only (invoice-update-status).
-- Out of scope: public-pay, webhooks, refunds/chargebacks/reversals.

create extension if not exists pgcrypto;

-- ----------------------------
-- Normalization helpers
-- ----------------------------

create or replace function public.normalize_manual_reference(p_value text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

-- ----------------------------
-- payment_attempts (manual/offline)
-- ----------------------------

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,

  writer_mode text not null default 'offline',
  idempotency_key text not null,

  manual_reference_raw text not null,
  manual_reference_norm text not null,

  amount numeric not null,
  payment_method text not null,

  attempt_status text not null default 'received',
  resolved_transaction_id uuid null,

  created_by_user_id uuid null,
  request_id text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_attempts_amount_positive check (amount > 0),
  constraint payment_attempts_reference_norm_matches
    check (manual_reference_norm = public.normalize_manual_reference(manual_reference_raw))
);

create index if not exists payment_attempts_tenant_invoice_idx
  on public.payment_attempts (tenant_id, invoice_id, created_at desc);

create unique index if not exists ux_payment_attempts_invoice_reference
  on public.payment_attempts (tenant_id, invoice_id, manual_reference_norm);

create unique index if not exists ux_payment_attempts_tenant_idempotency
  on public.payment_attempts (tenant_id, idempotency_key);

-- Link resolved_transaction_id after transactions exists.
do $$
begin
  if to_regclass('public.transactions') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'payment_attempts_resolved_transaction_fk'
        and conrelid = 'public.payment_attempts'::regclass
    ) then
      alter table public.payment_attempts
        add constraint payment_attempts_resolved_transaction_fk
        foreign key (resolved_transaction_id)
        references public.transactions(id)
        on delete set null;
    end if;
  end if;
end $$;

-- ----------------------------
-- transactions (extend existing table; do not break existing readers)
-- ----------------------------

alter table public.transactions
  add column if not exists source text,
  add column if not exists currency text,
  add column if not exists provider_reference text,
  add column if not exists idempotency_key text,
  add column if not exists manual_reference_norm text,
  add column if not exists created_by_user_id uuid,
  add column if not exists recorded_at timestamptz;

update public.transactions
set
  source = coalesce(source, 'legacy'),
  currency = coalesce(currency, 'usd'),
  idempotency_key = coalesce(idempotency_key, gen_random_uuid()::text),
  recorded_at = coalesce(recorded_at, created_at, now())
where source is null
   or currency is null
   or idempotency_key is null
   or recorded_at is null;

alter table public.transactions
  alter column source set default 'legacy',
  alter column currency set default 'usd',
  alter column recorded_at set default now();

alter table public.transactions
  alter column idempotency_key set not null;

create unique index if not exists ux_transactions_tenant_idempotency
  on public.transactions (tenant_id, idempotency_key);

create unique index if not exists ux_transactions_tenant_provider_reference
  on public.transactions (tenant_id, provider_reference)
  where provider_reference is not null;

create index if not exists transactions_source_idx
  on public.transactions (source);

-- ----------------------------
-- transaction_applications (invoice settlement mapping)
-- ----------------------------

create table if not exists public.transaction_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  applied_amount numeric not null,
  application_type text not null default 'payment',
  created_by_user_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint transaction_applications_positive_amount check (applied_amount > 0)
);

create unique index if not exists ux_transaction_applications_tx_invoice
  on public.transaction_applications (transaction_id, invoice_id);

create index if not exists transaction_applications_invoice_idx
  on public.transaction_applications (tenant_id, invoice_id, applied_at desc);

-- ----------------------------
-- invoices settlement projection fields (minimum)
-- ----------------------------

alter table public.invoices
  add column if not exists settlement_status text,
  add column if not exists last_payment_at timestamptz;

-- ----------------------------
-- Settlement recompute function (authoritative projection update)
-- ----------------------------

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
    balance_due = v_due,
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

-- ----------------------------
-- Atomic manual/offline writer (single-transaction ledger + settlement)
-- ----------------------------

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
  returning id into transaction_id;

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
    transaction_id,
    p_invoice_id,
    p_amount,
    'payment',
    p_actor_user_id,
    jsonb_build_object('manual_reference', v_reference_norm)
  )
  on conflict (transaction_id, invoice_id)
  do nothing;

  update public.payment_attempts
  set
    resolved_transaction_id = transaction_id,
    attempt_status = 'resolved',
    updated_at = now()
  where id = v_attempt.id;

  perform public.recalculate_invoice_settlement(p_invoice_id);

  ok := true;
  duplicate := false;
  payment_attempt_id := v_attempt.id;
  return next;
end;
$$;

