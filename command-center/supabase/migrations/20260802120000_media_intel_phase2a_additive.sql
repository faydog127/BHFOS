-- MIL Phase 2A Migration A — ADDITIVE COMPATIBILITY
-- Canonical plane: mil.bhfos.com + sdzhdupekcnekesbtxsl
-- Safe before restrictive lockdown: adds RPCs, outbox, helpers. Does NOT revoke
-- privileges the currently deployed frontend/edge still depend on.
--
-- Companion: 20260802130000_media_intel_phase2a_lockdown.sql (apply only after
-- new code is live and verified).
-- Rollback: supabase/rollbacks/phase2a_media_intel_rollback.sql

begin;

-- ---------------------------------------------------------------------------
-- 1. Durable audit outbox (full model)
-- ---------------------------------------------------------------------------
create table if not exists public.mil_audit_outbox (
  id uuid primary key default gen_random_uuid(),
  classification text not null
    check (classification in ('essential', 'access')),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'pending'
    check (status in (
      'pending', 'processing', 'delivered', 'failed', 'terminal_failed'
    )),
  attempt_count integer not null default 0,
  next_retry_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  completed_at timestamptz,
  terminal_failed_at timestamptz,
  terminal_failure_reason text,
  claimed_by text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mil_audit_outbox_idempotency_uniq unique (idempotency_key)
);

-- Ensure required columns exist when upgrading an earlier thin draft table.
alter table public.mil_audit_outbox add column if not exists event_type text;
alter table public.mil_audit_outbox add column if not exists entity_type text;
alter table public.mil_audit_outbox add column if not exists entity_id uuid;
alter table public.mil_audit_outbox add column if not exists actor_id uuid;
alter table public.mil_audit_outbox add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.mil_audit_outbox add column if not exists idempotency_key text;
alter table public.mil_audit_outbox add column if not exists attempt_count integer not null default 0;
alter table public.mil_audit_outbox add column if not exists next_retry_at timestamptz not null default now();
alter table public.mil_audit_outbox add column if not exists last_attempt_at timestamptz;
alter table public.mil_audit_outbox add column if not exists last_error_code text;
alter table public.mil_audit_outbox add column if not exists last_error_message text;
alter table public.mil_audit_outbox add column if not exists completed_at timestamptz;
alter table public.mil_audit_outbox add column if not exists terminal_failed_at timestamptz;
alter table public.mil_audit_outbox add column if not exists terminal_failure_reason text;
alter table public.mil_audit_outbox add column if not exists claimed_by text;
alter table public.mil_audit_outbox add column if not exists claimed_at timestamptz;

-- Backfill only using columns that exist on this table (no legacy action/details assumed).
update public.mil_audit_outbox
set
  event_type = coalesce(nullif(event_type, ''), 'unknown'),
  entity_type = coalesce(nullif(entity_type, ''), 'unknown'),
  idempotency_key = coalesce(nullif(idempotency_key, ''), id::text)
where event_type is null
   or entity_type is null
   or idempotency_key is null
   or idempotency_key = '';

do $$
begin
  alter table public.mil_audit_outbox alter column event_type set not null;
  alter table public.mil_audit_outbox alter column entity_type set not null;
  alter table public.mil_audit_outbox alter column idempotency_key set not null;
exception when others then
  null;
end $$;

drop index if exists public.mil_audit_outbox_claim_idx;
create index if not exists mil_audit_outbox_claim_idx
  on public.mil_audit_outbox (status, next_retry_at, claimed_at)
  where status in ('pending', 'failed', 'processing');

create index if not exists mil_audit_outbox_terminal_idx
  on public.mil_audit_outbox (status, terminal_failed_at)
  where status = 'terminal_failed';

alter table public.mil_audit_outbox enable row level security;

-- Ordinary users (including authenticated) must not read or mutate outbox.
drop policy if exists mil_browse_audit_outbox on public.mil_audit_outbox;
revoke all on public.mil_audit_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.mil_audit_outbox to service_role;

comment on table public.mil_audit_outbox is
  'Phase 2A durable audit outbox. Essential events commit with business state; access events enqueue without denying access. No client grants.';

-- ---------------------------------------------------------------------------
-- 2. Deterministic mil_current_role (priority, created_at DESC NULLS LAST, id DESC)
-- ---------------------------------------------------------------------------
create or replace function public.mil_current_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return 'unauthenticated';
  end if;

  select r.role into v_role
  from public.app_user_roles r
  where r.user_id = auth.uid()
  order by
    case public.mil_normalize_role(r.role)
      when 'admin' then 1
      when 'manager' then 2
      when 'media_reviewer' then 3
      when 'office' then 4
      when 'reel_creator' then 5
      when 'phone_uploader' then 6
      when 'technician' then 7
      else 99
    end asc,
    r.created_at desc nulls last,
    r.id desc
  limit 1;

  if v_role is null or btrim(v_role) = '' then
    return 'unauthenticated';
  end if;

  return public.mil_normalize_role(v_role);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Outbox helpers + worker claim/complete (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.mil_sanitize_outbox_error(p_msg text)
returns text
language plpgsql
immutable
as $$
declare
  v text := coalesce(p_msg, '');
begin
  -- Bucket names, object paths, project refs, tokens/keys, SQL/constraint text,
  -- provider payloads, and stack traces must never land in operator-facing fields.
  -- Note: PostgreSQL uses POSIX regex (no JS \b); use [[:<:]] / [[:>:]] boundaries.
  v := regexp_replace(v, 'wwyxohjnyqnegzbxtuxs', '[redacted_ref]', 'gi');
  v := regexp_replace(v, 'sdzhdupekcnekesbtxsl', '[redacted_ref]', 'gi');
  v := regexp_replace(v, '[A-Za-z0-9-]+\.supabase\.co', '[redacted_host]', 'gi');
  v := regexp_replace(v, 'media-intel-(originals|derivatives|quarantine)', '[redacted_bucket]', 'gi');
  v := regexp_replace(v, 'website-public-media', '[redacted_bucket]', 'gi');
  v := regexp_replace(v, '[[:<:]]mil/[^[:space:]''"]+', '[redacted_path]', 'gi');
  v := regexp_replace(v, '[[:<:]]sbp_[A-Za-z0-9]+', '[redacted_secret]', 'gi');
  v := regexp_replace(
    v,
    '[[:<:]](authorization|bearer|access_token|refresh_token|api[_-]?key|secret|service_role)[=:[:space:]]+[A-Za-z0-9._\-/+]+',
    '[redacted_secret]',
    'gi'
  );
  v := regexp_replace(
    v,
    'violates[[:space:]]+(unique|check|foreign key|not-null)[[:space:]]+constraint[[:space:]]+"?[^"]+"?',
    'constraint violation',
    'gi'
  );
  v := regexp_replace(v, 'duplicate key value[^\n]*', 'duplicate key', 'gi');
  v := regexp_replace(v, 'permission denied for[^\n]*', 'permission denied', 'gi');
  v := regexp_replace(v, '[[:<:]](PGRST[0-9]+|SQLSTATE[[:space:]]+[A-Za-z0-9]+|postgres)[[:>:]]', '[redacted_sql]', 'gi');
  v := regexp_replace(v, 'stack trace:.*$', 'stack trace: [redacted]', 'gi');
  v := regexp_replace(v, 'at[[:space:]]+[^[:space:]]+[[:space:]]+\([^)]+:[0-9]+:[0-9]+\)', '[redacted_frame]', 'gi');
  v := regexp_replace(
    v,
    '"?(object_path|storage_path|storage_bucket)"?[[:space:]]*[:=][[:space:]]*"?[^"[:space:],]+"?',
    '[redacted_storage]',
    'gi'
  );
  return left(v, 500);
end;
$$;

-- Projection idempotency: each outbox row projects to at most one audit event.
-- UNIQUE (outbox_id) allows multiple NULLs (non-projected / direct inserts).
alter table public.mil_audit_events
  add column if not exists outbox_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mil_audit_events_outbox_id_key'
      and conrelid = 'public.mil_audit_events'::regclass
  ) then
    alter table public.mil_audit_events
      add constraint mil_audit_events_outbox_id_key unique (outbox_id);
  end if;
end $$;

comment on column public.mil_audit_events.outbox_id is
  'Phase 2A: originating mil_audit_outbox.id when projected; enforces idempotent projection.';

-- Logical-event idempotency for upload session/grant audits.
-- Lets Migration A coexist with deployed tip d90eb8f which still inserts
-- mil_audit_events after the business write that already fired triggers.
alter table public.mil_audit_events
  add column if not exists event_key text;

create unique index if not exists mil_audit_events_event_key_uidx
  on public.mil_audit_events (event_key)
  where event_key is not null;

comment on column public.mil_audit_events.event_key is
  'Phase 2A: deterministic logical-event key (e.g. upload_session_created:<id>). NULL for advisory/access rows.';

create or replace function public.mil_audit_derive_event_key(
  p_action text,
  p_target_id uuid
)
returns text
language sql
immutable
as $$
  select case
    when p_target_id is null then null
    when p_action in ('upload_session_created', 'contributor_upload_session_created')
      then 'upload_session_created:' || p_target_id::text
    when p_action = 'upload_session_revoked'
      then 'upload_session_revoked:' || p_target_id::text
    when p_action in ('upload_grant_minted', 'upload_session_mint')
      then 'upload_grant_minted:' || p_target_id::text
    else null
  end;
$$;

create or replace function public.mil_trg_audit_events_event_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  v_key := coalesce(
    nullif(trim(NEW.event_key), ''),
    public.mil_audit_derive_event_key(NEW.action, NEW.target_id)
  );
  if v_key is null then
    NEW.event_key := null;
    return NEW;
  end if;
  NEW.event_key := v_key;
  -- Idempotent no-op for old-edge second inserts (and concurrent retries).
  if exists (
    select 1 from public.mil_audit_events e where e.event_key = v_key
  ) then
    return null;
  end if;
  return NEW;
exception
  when unique_violation then
    return null;
end;
$$;

drop trigger if exists mil_trg_audit_events_event_key on public.mil_audit_events;
create trigger mil_trg_audit_events_event_key
  before insert on public.mil_audit_events
  for each row execute function public.mil_trg_audit_events_event_key();

create or replace function public.mil_outbox_enqueue(
  p_classification text,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_classification not in ('essential', 'access') then
    raise exception 'Invalid outbox classification';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'idempotency_key required';
  end if;

  insert into public.mil_audit_outbox (
    classification, event_type, entity_type, entity_id, actor_id,
    payload, idempotency_key, status, attempt_count, next_retry_at
  ) values (
    p_classification, p_event_type, p_entity_type, p_entity_id, p_actor_id,
    coalesce(p_payload, '{}'::jsonb), trim(p_idempotency_key),
    'pending', 0, now()
  )
  on conflict (idempotency_key) do update
    set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.mil_outbox_enqueue(text, text, text, uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.mil_outbox_enqueue(text, text, text, uuid, uuid, jsonb, text)
  to service_role;

-- Claim up to N pending/failed/stale-processing rows (SKIP LOCKED + lease).
-- Explicit lease: processing rows become claimable again after p_lease_seconds
-- so a crashed worker cannot permanently strand work.
drop function if exists public.mil_outbox_claim_batch(integer, text, integer);
create or replace function public.mil_outbox_claim_batch(
  p_limit integer default 20,
  p_worker_id text default 'worker',
  p_max_attempts integer default 8,
  p_lease_seconds integer default 300
)
returns setof public.mil_audit_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease interval := make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 300), 3600)));
begin
  return query
  with picked as (
    select o.id
    from public.mil_audit_outbox o
    where o.status not in ('delivered', 'terminal_failed')
      and o.attempt_count < coalesce(p_max_attempts, 8)
      and (
        (o.status in ('pending', 'failed') and o.next_retry_at <= now())
        or (
          o.status = 'processing'
          and o.claimed_at is not null
          and o.claimed_at < now() - v_lease
        )
      )
    order by o.next_retry_at asc nulls first, o.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.mil_audit_outbox o
  set
    status = 'processing',
    claimed_by = left(coalesce(p_worker_id, 'worker'), 120),
    claimed_at = now(),
    last_attempt_at = now(),
    attempt_count = o.attempt_count + 1,
    updated_at = now()
  from picked
  where o.id = picked.id
  returning o.*;
end;
$$;

revoke all on function public.mil_outbox_claim_batch(integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.mil_outbox_claim_batch(integer, text, integer, integer)
  to service_role;

create or replace function public.mil_outbox_mark_delivered(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mil_audit_outbox
  set
    status = 'delivered',
    completed_at = now(),
    updated_at = now(),
    claimed_by = null,
    claimed_at = null,
    last_error_code = null,
    last_error_message = null
  where id = p_id;
end;
$$;

create or replace function public.mil_outbox_mark_failure(
  p_id uuid,
  p_error_code text,
  p_error_message text,
  p_max_attempts integer default 8
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mil_audit_outbox%rowtype;
  v_delay interval;
begin
  select * into v_row from public.mil_audit_outbox where id = p_id for update;
  if not found then
    return;
  end if;

  if v_row.attempt_count >= coalesce(p_max_attempts, 8) then
    update public.mil_audit_outbox
    set
      status = 'terminal_failed',
      terminal_failed_at = now(),
      terminal_failure_reason = public.mil_sanitize_outbox_error(p_error_message),
      last_error_code = left(coalesce(p_error_code, 'ERROR'), 80),
      last_error_message = public.mil_sanitize_outbox_error(p_error_message),
      updated_at = now(),
      claimed_by = null,
      claimed_at = null
    where id = p_id;
    return;
  end if;

  -- Bounded exponential backoff: 30s * 2^(attempt-1), capped at 1 hour
  v_delay := least(
    interval '1 hour',
    (interval '30 seconds') * power(2, greatest(v_row.attempt_count - 1, 0))
  );

  update public.mil_audit_outbox
  set
    status = 'failed',
    next_retry_at = now() + v_delay,
    last_error_code = left(coalesce(p_error_code, 'ERROR'), 80),
    last_error_message = public.mil_sanitize_outbox_error(p_error_message),
    updated_at = now(),
    claimed_by = null,
    claimed_at = null
  where id = p_id;
end;
$$;

revoke all on function public.mil_outbox_mark_delivered(uuid) from public, anon, authenticated;
revoke all on function public.mil_outbox_mark_failure(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.mil_outbox_mark_delivered(uuid) to service_role;
grant execute on function public.mil_outbox_mark_failure(uuid, text, text, integer) to service_role;

-- Access audit: try mil_audit_events; on failure enqueue outbox (never raise).
create or replace function public.mil_record_access_audit(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_details jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_key text;
begin
  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    p_action || ':' || coalesce(p_target_id::text, 'none') || ':' || gen_random_uuid()::text
  );
  begin
    insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
    values (p_actor_id, p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb))
    returning id into v_id;
    return jsonb_build_object('ok', true, 'audit_id', v_id, 'via', 'events');
  exception when others then
    perform public.mil_outbox_enqueue(
      'access', p_action, p_target_type, p_target_id, p_actor_id,
      coalesce(p_details, '{}'::jsonb) || jsonb_build_object('enqueue_reason', SQLERRM),
      v_key
    );
    return jsonb_build_object('ok', false, 'queued', true, 'via', 'outbox');
  end;
end;
$$;

revoke all on function public.mil_record_access_audit(uuid, text, text, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.mil_record_access_audit(uuid, text, text, uuid, jsonb, text)
  to service_role;

-- Project outbox rows into mil_audit_events (idempotent via outbox_id UNIQUE).
create or replace function public.mil_outbox_project_one(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.mil_audit_outbox%rowtype;
  v_event_id uuid;
  v_safe_payload jsonb;
begin
  select * into v_row from public.mil_audit_outbox where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_row.status = 'delivered' then
    select id into v_event_id from public.mil_audit_events where outbox_id = p_id limit 1;
    return jsonb_build_object('ok', true, 'already', true, 'audit_id', v_event_id);
  end if;
  if v_row.status = 'terminal_failed' then
    return jsonb_build_object('ok', false, 'reason', 'terminal_failed');
  end if;

  select id into v_event_id from public.mil_audit_events where outbox_id = p_id limit 1;
  if v_event_id is not null then
    perform public.mil_outbox_mark_delivered(p_id);
    return jsonb_build_object('ok', true, 'already', true, 'audit_id', v_event_id);
  end if;

  -- Never project raw secrets/paths from payload into audit details.
  v_safe_payload := coalesce(v_row.payload, '{}'::jsonb)
    - 'access_token' - 'refresh_token' - 'token' - 'authorization'
    - 'service_role' - 'apikey' - 'api_key' - 'secret' - 'stack';

  insert into public.mil_audit_events (
    actor_user_id, action, target_type, target_id, details, outbox_id
  ) values (
    v_row.actor_id,
    v_row.event_type,
    v_row.entity_type,
    v_row.entity_id,
    v_safe_payload || jsonb_build_object('outbox_id', v_row.id),
    v_row.id
  )
  on conflict on constraint mil_audit_events_outbox_id_key do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id into v_event_id from public.mil_audit_events where outbox_id = p_id limit 1;
  end if;

  perform public.mil_outbox_mark_delivered(p_id);
  return jsonb_build_object('ok', true, 'audit_id', v_event_id);
exception when others then
  perform public.mil_outbox_mark_failure(
    p_id,
    left(coalesce(SQLSTATE, 'ERROR'), 80),
    public.mil_sanitize_outbox_error(SQLERRM),
    8
  );
  return jsonb_build_object('ok', false, 'error', public.mil_sanitize_outbox_error(SQLERRM));
end;
$$;

revoke all on function public.mil_outbox_project_one(uuid) from public, anon, authenticated;
grant execute on function public.mil_outbox_project_one(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Essential creator role grant/revoke (mutation + audit in one transaction)
--    Respects legacy app_user_roles.tenant_id when present (NOT NULL locally).
--    Tenant is derived from explicit validated param, actor, or invitee — never
--    hard-coded. Cross-tenant grants are denied.
-- ---------------------------------------------------------------------------
create or replace function public.mil_resolve_role_tenant(
  p_actor_id uuid,
  p_user_id uuid,
  p_tenant_id text default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_has_tenant boolean;
  v_tenant text;
  v_actor_tenant text;
  v_user_tenant text;
  v_foreign int;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_user_roles'
      and column_name = 'tenant_id'
  ) into v_has_tenant;

  if not v_has_tenant then
    return null;
  end if;

  v_tenant := nullif(trim(coalesce(p_tenant_id, '')), '');

  select nullif(trim(r.tenant_id), '') into v_actor_tenant
  from public.app_user_roles r
  where r.user_id = p_actor_id
    and nullif(trim(r.tenant_id), '') is not null
  order by r.created_at desc nulls last, r.id desc
  limit 1;

  select nullif(trim(r.tenant_id), '') into v_user_tenant
  from public.app_user_roles r
  where r.user_id = p_user_id
    and nullif(trim(r.tenant_id), '') is not null
  order by r.created_at desc nulls last, r.id desc
  limit 1;

  v_tenant := coalesce(v_tenant, v_actor_tenant, v_user_tenant);

  if v_tenant is null then
    raise exception 'TENANT_REQUIRED: cannot resolve tenant_id for role grant'
      using errcode = 'P0001';
  end if;

  if v_actor_tenant is not null and v_actor_tenant is distinct from v_tenant then
    raise exception 'CROSS_TENANT_DENIED: actor tenant does not match requested tenant'
      using errcode = 'P0001';
  end if;

  select count(*)::int into v_foreign
  from public.app_user_roles r
  where r.user_id = p_user_id
    and nullif(trim(r.tenant_id), '') is not null
    and r.tenant_id is distinct from v_tenant;

  if v_foreign > 0 then
    raise exception 'CROSS_TENANT_DENIED: invitee already has roles in another tenant'
      using errcode = 'P0001';
  end if;

  return v_tenant;
end;
$$;

revoke all on function public.mil_resolve_role_tenant(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.mil_resolve_role_tenant(uuid, uuid, text)
  to service_role;

drop function if exists public.mil_grant_creator_role_audited(uuid, uuid, jsonb, text);
create or replace function public.mil_grant_creator_role_audited(
  p_user_id uuid,
  p_actor_id uuid,
  p_details jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_tenant_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_key text;
  v_audit uuid;
  v_tenant text;
  v_has_tenant boolean;
  v_dup boolean := false;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;
  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'creator_invited:' || p_user_id::text || ':' || coalesce(p_actor_id::text, 'system')
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_user_roles'
      and column_name = 'tenant_id'
  ) into v_has_tenant;

  v_tenant := public.mil_resolve_role_tenant(p_actor_id, p_user_id, p_tenant_id);

  if v_has_tenant then
    select id into v_existing
    from public.app_user_roles
    where user_id = p_user_id
      and public.mil_normalize_role(role) = 'reel_creator'
      and tenant_id is not distinct from v_tenant
    order by created_at desc nulls last, id desc
    limit 1;
  else
    select id into v_existing
    from public.app_user_roles
    where user_id = p_user_id
      and public.mil_normalize_role(role) = 'reel_creator'
    order by created_at desc nulls last, id desc
    limit 1;
  end if;

  if v_existing is null then
    if v_has_tenant then
      insert into public.app_user_roles (user_id, role, tenant_id)
      values (p_user_id, 'reel_creator', v_tenant)
      returning id into v_existing;
    else
      insert into public.app_user_roles (user_id, role)
      values (p_user_id, 'reel_creator')
      returning id into v_existing;
    end if;
  else
    v_dup := true;
    if v_has_tenant then
      update public.app_user_roles
      set role = 'reel_creator', tenant_id = v_tenant
      where id = v_existing;
    else
      update public.app_user_roles set role = 'reel_creator' where id = v_existing;
    end if;
  end if;

  -- Essential audit in same transaction — failure rolls back role change.
  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    p_actor_id,
    'creator_invited',
    'auth.users',
    p_user_id,
    coalesce(p_details, '{}'::jsonb) || jsonb_build_object(
      'idempotency_key', v_key,
      'tenant_id', v_tenant,
      'idempotent', v_dup
    )
  )
  returning id into v_audit;

  return jsonb_build_object(
    'ok', true,
    'role_row_id', v_existing,
    'audit_id', v_audit,
    'tenant_id', v_tenant,
    'idempotent', v_dup
  );
end;
$$;

drop function if exists public.mil_revoke_creator_access_audited(uuid, uuid, jsonb, text);
create or replace function public.mil_revoke_creator_access_audited(
  p_user_id uuid,
  p_actor_id uuid,
  p_details jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_tenant_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
  v_revoked int;
  v_key text;
  v_audit uuid;
  v_tenant text;
  v_has_tenant boolean;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;
  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'creator_access_revoked:' || p_user_id::text || ':' || coalesce(p_actor_id::text, 'system')
  );

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_user_roles'
      and column_name = 'tenant_id'
  ) into v_has_tenant;

  if v_has_tenant then
    v_tenant := public.mil_resolve_role_tenant(p_actor_id, p_user_id, p_tenant_id);
    delete from public.app_user_roles
    where user_id = p_user_id
      and public.mil_normalize_role(role) = 'reel_creator'
      and tenant_id is not distinct from v_tenant;
  else
    delete from public.app_user_roles
    where user_id = p_user_id
      and public.mil_normalize_role(role) = 'reel_creator';
  end if;
  get diagnostics v_deleted = row_count;

  update public.mil_creator_assignments
  set status = 'revoked', revoked_at = now()
  where creator_user_id = p_user_id
    and status = 'active';
  get diagnostics v_revoked = row_count;

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    p_actor_id,
    'creator_access_revoked',
    'auth.users',
    p_user_id,
    coalesce(p_details, '{}'::jsonb) || jsonb_build_object(
      'idempotency_key', v_key,
      'tenant_id', v_tenant,
      'revokedRoleRows', v_deleted,
      'revokedAssignments', v_revoked
    )
  )
  returning id into v_audit;

  return jsonb_build_object(
    'ok', true,
    'revokedRoleRows', v_deleted,
    'revokedAssignments', v_revoked,
    'audit_id', v_audit,
    'tenant_id', v_tenant
  );
end;
$$;

revoke all on function public.mil_grant_creator_role_audited(uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.mil_revoke_creator_access_audited(uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.mil_grant_creator_role_audited(uuid, uuid, jsonb, text, text)
  to service_role;
grant execute on function public.mil_revoke_creator_access_audited(uuid, uuid, jsonb, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 5. Compliance RPC with lifecycle guard (additive; lockdown comes in Migration B)
-- ---------------------------------------------------------------------------
create or replace function public.mil_set_asset_compliance(
  p_asset_id uuid,
  p_privacy_status text default null,
  p_rights_status text default null,
  p_customer_permission_status text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.mil_assets%rowtype;
  v_changed jsonb := '{}'::jsonb;
  v_before_vals jsonb := '{}'::jsonb;
  v_after_vals jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = 'P0001';
  end if;
  if not public.mil_is_reviewer() then
    raise exception 'Only reviewers/owner/admin may change compliance fields'
      using errcode = 'P0001';
  end if;
  if p_privacy_status is null
     and p_rights_status is null
     and p_customer_permission_status is null then
    raise exception 'Provide at least one of privacy, rights, or customer permission'
      using errcode = 'P0001';
  end if;

  select * into v_before
  from public.mil_assets
  where id = p_asset_id
  for update;
  if not found then
    raise exception 'Media not found' using errcode = 'P0001';
  end if;

  -- Lifecycle inactive: require Restore before compliance changes.
  if v_before.trashed_at is not null then
    raise exception 'ASSET_LIFECYCLE_INACTIVE: restore media from trash before changing compliance'
      using errcode = 'P0001';
  end if;
  if v_before.archived_at is not null then
    raise exception 'ASSET_LIFECYCLE_INACTIVE: restore media from archive before changing compliance'
      using errcode = 'P0001';
  end if;
  if v_before.purge_eligible_at is not null
     and v_before.purge_eligible_at <= now()
     and v_before.trashed_at is not null then
    raise exception 'ASSET_LIFECYCLE_INACTIVE: media pending permanent deletion cannot change compliance'
      using errcode = 'P0001';
  end if;

  if p_privacy_status is not null then
    if p_privacy_status not in ('clear', 'needs_review', 'needs_redaction', 'restricted') then
      raise exception 'Invalid privacy_status' using errcode = 'P0001';
    end if;
    if p_privacy_status in ('clear', 'restricted') and not public.mil_is_owner_admin() then
      if v_before.privacy_status is distinct from p_privacy_status then
        raise exception 'Only owner/admin may set privacy to clear or restricted'
          using errcode = 'P0001';
      end if;
    end if;
    v_before_vals := v_before_vals || jsonb_build_object('privacy_status', v_before.privacy_status);
    v_after_vals := v_after_vals || jsonb_build_object('privacy_status', p_privacy_status);
    v_changed := v_changed || jsonb_build_object('privacy_status', true);
  end if;

  if p_rights_status is not null then
    if p_rights_status not in (
      'tvg_owned', 'employee_supplied', 'contractor_supplied', 'property_supplied',
      'ownership_unknown', 'permission_confirmed', 'permission_unknown', 'public_use_prohibited'
    ) then
      raise exception 'Invalid rights_status' using errcode = 'P0001';
    end if;
    if not public.mil_is_owner_admin() then
      raise exception 'Only owner/admin may change rights_status' using errcode = 'P0001';
    end if;
    v_before_vals := v_before_vals || jsonb_build_object('rights_status', v_before.rights_status);
    v_after_vals := v_after_vals || jsonb_build_object('rights_status', p_rights_status);
    v_changed := v_changed || jsonb_build_object('rights_status', true);
  end if;

  if p_customer_permission_status is not null then
    if p_customer_permission_status not in ('unknown', 'confirmed', 'denied', 'not_required') then
      raise exception 'Invalid customer_permission_status' using errcode = 'P0001';
    end if;
    if not public.mil_is_owner_admin() then
      raise exception 'Only owner/admin may change customer_permission_status'
        using errcode = 'P0001';
    end if;
    v_before_vals := v_before_vals || jsonb_build_object(
      'customer_permission_status', v_before.customer_permission_status
    );
    v_after_vals := v_after_vals || jsonb_build_object(
      'customer_permission_status', p_customer_permission_status
    );
    v_changed := v_changed || jsonb_build_object('customer_permission_status', true);
  end if;

  update public.mil_assets
  set
    privacy_status = coalesce(p_privacy_status, privacy_status),
    rights_status = coalesce(p_rights_status, rights_status),
    customer_permission_status = coalesce(
      p_customer_permission_status, customer_permission_status
    ),
    updated_at = now()
  where id = p_asset_id;

  -- Essential audit — same transaction (rolls back mutation on failure).
  perform public.mil_audit_insert(
    'asset_compliance_updated',
    'mil_assets',
    p_asset_id,
    jsonb_build_object(
      'actor', auth.uid(),
      'changed_fields', v_changed,
      'before', v_before_vals,
      'after', v_after_vals,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'at', now()
    )
  );

  return jsonb_build_object(
    'ok', true,
    'asset_id', p_asset_id,
    'changed_fields', v_changed,
    'before', v_before_vals,
    'after', v_after_vals
  );
end;
$$;

revoke all on function public.mil_set_asset_compliance(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.mil_set_asset_compliance(uuid, text, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Same-transaction essential audit for upload session/grant writes
--    Edge service_role inserts participate in one DB transaction with the trigger.
--    event_key uniqueness + BEFORE INSERT no-op makes old tip d90eb8f second
--    inserts (upload_session_created / contributor_upload_session_created /
--    upload_session_mint / upload_session_revoked) idempotent with triggers.
-- ---------------------------------------------------------------------------
create or replace function public.mil_trg_audit_upload_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    begin
      insert into public.mil_audit_events (
        actor_user_id, action, target_type, target_id, details, event_key
      )
      values (
        NEW.created_by,
        'upload_session_created',
        'mil_upload_sessions',
        NEW.id,
        jsonb_build_object('batch_id', NEW.batch_id, 'via', 'trigger'),
        'upload_session_created:' || NEW.id::text
      );
    exception when unique_violation then
      null; -- concurrent / old-edge coexistence
    end;
  elsif TG_OP = 'UPDATE' and NEW.revoked_at is not null
        and (OLD.revoked_at is null) then
    begin
      insert into public.mil_audit_events (
        actor_user_id, action, target_type, target_id, details, event_key
      )
      values (
        NEW.created_by,
        'upload_session_revoked',
        'mil_upload_sessions',
        NEW.id,
        jsonb_build_object('via', 'trigger'),
        'upload_session_revoked:' || NEW.id::text
      );
    exception when unique_violation then
      null;
    end;
  end if;
  return NEW;
end;
$$;

drop trigger if exists mil_trg_audit_upload_session on public.mil_upload_sessions;
create trigger mil_trg_audit_upload_session
  after insert or update on public.mil_upload_sessions
  for each row execute function public.mil_trg_audit_upload_session();

create or replace function public.mil_trg_audit_upload_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    begin
      insert into public.mil_audit_events (
        actor_user_id, action, target_type, target_id, details, event_key
      )
      values (
        null,
        'upload_grant_minted',
        'mil_upload_grants',
        NEW.id,
        jsonb_build_object(
          'session_id', NEW.session_id,
          'asset_id', NEW.asset_id,
          'via', 'trigger'
        ),
        'upload_grant_minted:' || NEW.id::text
      );
    exception when unique_violation then
      null;
    end;
  end if;
  return NEW;
end;
$$;

drop trigger if exists mil_trg_audit_upload_grant on public.mil_upload_grants;
create trigger mil_trg_audit_upload_grant
  after insert on public.mil_upload_grants
  for each row execute function public.mil_trg_audit_upload_grant();

-- Avoid double-audit: revoke RPC previously inserted mil_audit_events; trigger now owns it.
create or replace function public.mil_revoke_upload_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may revoke upload sessions';
  end if;
  update public.mil_upload_sessions
  set revoked_at = now()
  where id = p_session_id
    and revoked_at is null;
  -- Audit emitted by mil_trg_audit_upload_session in the same transaction.
  return found;
end;
$$;

revoke all on function public.mil_revoke_upload_session(uuid) from public, anon;
grant execute on function public.mil_revoke_upload_session(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Essential reel mint / complete + website unpublish (mutation + audit TX)
-- ---------------------------------------------------------------------------
alter table public.mil_website_promotions
  add column if not exists unpublished_at timestamptz;

comment on column public.mil_website_promotions.unpublished_at is
  'Phase 2A: set by mil_unpublish_website_audited in the same TX as the audit event.';

-- Drop prior 10-arg signature before adding operation_id parameter.
drop function if exists public.mil_mint_reel_upload_grant_audited(
  uuid, uuid, uuid, text, uuid, text, bigint, text, uuid, text
);

-- Ledger for stable reel-mint logical operations (client operationId reused on retry).
create table if not exists public.mil_reel_mint_operations (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.mil_reel_projects(id) on delete cascade,
  operation_id uuid not null,
  collection_id uuid,
  grant_id uuid not null references public.mil_reel_upload_grants(id) on delete cascade,
  version_id uuid not null references public.mil_reel_versions(id) on delete cascade,
  actor_user_id uuid,
  content_type text not null,
  max_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint mil_reel_mint_ops_creator_project_op_uniq
    unique (creator_user_id, project_id, operation_id),
  constraint mil_reel_mint_ops_creator_op_uniq
    unique (creator_user_id, operation_id),
  constraint mil_reel_mint_ops_grant_uniq unique (grant_id),
  constraint mil_reel_mint_ops_version_uniq unique (version_id)
);

create index if not exists mil_reel_mint_ops_project_idx
  on public.mil_reel_mint_operations (project_id, created_at desc);

alter table public.mil_reel_mint_operations enable row level security;
revoke all on public.mil_reel_mint_operations from public, anon, authenticated;
grant select, insert, update, delete on public.mil_reel_mint_operations to service_role;

comment on table public.mil_reel_mint_operations is
  'Phase 2A: durable reel-mint idempotency ledger keyed by creator + project + client operation_id.';

create or replace function public.mil_mint_reel_upload_grant_audited(
  p_actor_id uuid,
  p_creator_user_id uuid,
  p_project_id uuid default null,
  p_title text default null,
  p_collection_id uuid default null,
  p_content_type text default 'video/mp4',
  p_max_bytes bigint default 262144000,
  p_notes text default null,
  p_version_id uuid default null,
  p_idempotency_key text default null,
  p_operation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.mil_reel_projects%rowtype;
  v_version_id uuid;
  v_grant_id uuid;
  v_next int;
  v_path text;
  v_key text;
  v_audit uuid;
  v_expires timestamptz := now() + interval '1 hour';
  v_op uuid;
  v_ledger public.mil_reel_mint_operations%rowtype;
  v_grant public.mil_reel_upload_grants%rowtype;
  v_version public.mil_reel_versions%rowtype;
begin
  if p_actor_id is null or p_creator_user_id is null then
    raise exception 'actor and creator required' using errcode = 'P0001';
  end if;
  if p_operation_id is null then
    raise exception 'operation_id required' using errcode = 'P0001';
  end if;
  v_op := p_operation_id;
  if p_content_type not in ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v') then
    raise exception 'Unsupported reel content type' using errcode = 'P0001';
  end if;
  if p_max_bytes is null or p_max_bytes <= 0 then
    raise exception 'Invalid max_bytes' using errcode = 'P0001';
  end if;

  -- Serialize concurrent retries for the same creator+operation before ledger lookup.
  perform pg_advisory_xact_lock(
    hashtextextended(p_creator_user_id::text || ':' || v_op::text, 0)
  );

  -- Creator-scoped op must not bind to another project (global uniqueness).
  select * into v_ledger
  from public.mil_reel_mint_operations
  where creator_user_id = p_creator_user_id
    and operation_id = v_op;
  if found then
    if p_project_id is not null and v_ledger.project_id is distinct from p_project_id then
      raise exception 'REEL_MINT_OP_PROJECT_MISMATCH' using errcode = 'P0001';
    end if;
    if v_ledger.content_type is distinct from p_content_type
       or v_ledger.max_bytes is distinct from p_max_bytes then
      raise exception 'REEL_MINT_OP_FINGERPRINT_MISMATCH' using errcode = 'P0001';
    end if;
    select * into v_grant from public.mil_reel_upload_grants where id = v_ledger.grant_id;
    select * into v_version from public.mil_reel_versions where id = v_ledger.version_id;
    if v_grant.id is null or v_version.id is null then
      raise exception 'REEL_MINT_LEDGER_ORPHAN' using errcode = 'P0001';
    end if;
    -- Refresh expiry in place for incomplete draft grants under the same op.
    if v_grant.completed_at is null and v_grant.expires_at <= now() then
      update public.mil_reel_upload_grants
      set expires_at = now() + interval '1 hour'
      where id = v_grant.id
      returning * into v_grant;
    end if;
    select id into v_audit
    from public.mil_audit_events
    where action = 'reel_upload_grant_minted'
      and target_id = v_grant.id
    order by created_at desc
    limit 1;
    return jsonb_build_object(
      'ok', true,
      'adopted', true,
      'grantId', v_grant.id,
      'projectId', v_ledger.project_id,
      'versionId', v_ledger.version_id,
      'versionNumber', v_version.version_number,
      'objectPath', v_grant.object_path,
      'bucket', v_grant.bucket,
      'expiresAt', v_grant.expires_at,
      'maxBytes', v_grant.max_bytes,
      'audit_id', v_audit,
      'operationId', v_op
    );
  end if;

  if p_project_id is not null then
    select * into v_project from public.mil_reel_projects where id = p_project_id for update;
    if not found then
      raise exception 'Reel project not found' using errcode = 'P0001';
    end if;
    if v_project.creator_user_id is distinct from p_creator_user_id then
      raise exception 'REEL_MINT_CREATOR_MISMATCH' using errcode = 'P0001';
    end if;
  else
    insert into public.mil_reel_projects (title, creator_user_id, collection_id, status)
    values (
      coalesce(nullif(trim(p_title), ''), 'Untitled reel'),
      p_creator_user_id,
      p_collection_id,
      'creator_draft'
    )
    returning * into v_project;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.mil_reel_versions
  where project_id = v_project.id;

  v_version_id := coalesce(p_version_id, gen_random_uuid());
  v_path := 'mil/quarantine/reels/' || v_project.id::text || '/' || v_version_id::text || '.mp4';

  insert into public.mil_reel_versions (
    id, project_id, version_number, status, storage_bucket, storage_path, mime_type, creator_notes
  ) values (
    v_version_id, v_project.id, v_next, 'creator_draft',
    'media-intel-derivatives', v_path, p_content_type, p_notes
  );

  insert into public.mil_reel_upload_grants (
    creator_user_id, project_id, version_id, version_number,
    object_path, bucket, content_type, max_bytes, expires_at
  ) values (
    p_creator_user_id, v_project.id, v_version_id, v_next,
    v_path, 'media-intel-derivatives', p_content_type, p_max_bytes, v_expires
  )
  returning id into v_grant_id;

  insert into public.mil_reel_mint_operations (
    creator_user_id, project_id, operation_id, collection_id,
    grant_id, version_id, actor_user_id, content_type, max_bytes
  ) values (
    p_creator_user_id, v_project.id, v_op, coalesce(p_collection_id, v_project.collection_id),
    v_grant_id, v_version_id, p_actor_id, p_content_type, p_max_bytes
  );

  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'reel_mint:' || p_creator_user_id::text || ':' || v_project.id::text || ':' || v_op::text
  );

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    p_actor_id,
    'reel_upload_grant_minted',
    'mil_reel_upload_grants',
    v_grant_id,
    jsonb_build_object(
      'idempotency_key', v_key,
      'operationId', v_op,
      'projectId', v_project.id,
      'versionId', v_version_id,
      'versionNumber', v_next
    )
  )
  returning id into v_audit;

  return jsonb_build_object(
    'ok', true,
    'adopted', false,
    'grantId', v_grant_id,
    'projectId', v_project.id,
    'versionId', v_version_id,
    'versionNumber', v_next,
    'objectPath', v_path,
    'bucket', 'media-intel-derivatives',
    'expiresAt', v_expires,
    'maxBytes', p_max_bytes,
    'audit_id', v_audit,
    'operationId', v_op
  );
end;
$$;

create or replace function public.mil_complete_reel_upload_audited(
  p_actor_id uuid,
  p_grant_id uuid,
  p_final_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_checksum text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.mil_reel_upload_grants%rowtype;
  v_key text;
  v_audit uuid;
  v_adopted boolean := false;
begin
  if p_actor_id is null or p_grant_id is null then
    raise exception 'actor and grant required' using errcode = 'P0001';
  end if;
  if nullif(trim(p_final_path), '') is null
     or p_final_path not like 'mil/reels/%' then
    raise exception 'Invalid final reel path' using errcode = 'P0001';
  end if;
  if p_byte_size is null or p_byte_size <= 0 then
    raise exception 'Invalid byte size' using errcode = 'P0001';
  end if;

  select * into v_grant
  from public.mil_reel_upload_grants
  where id = p_grant_id
  for update;
  if not found then
    raise exception 'Reel upload grant not found' using errcode = 'P0001';
  end if;

  if v_grant.completed_at is not null then
    -- Idempotent adopt: prior successful completion must already have audit/outbox.
    select id into v_audit
    from public.mil_audit_events
    where action = 'reel_upload_completed'
      and target_id = v_grant.version_id
    order by created_at desc
    limit 1;
    if v_audit is null then
      raise exception 'ESSENTIAL_AUDIT_MISSING: completed grant without durable audit'
        using errcode = 'P0001';
    end if;
    return jsonb_build_object(
      'ok', true,
      'adopted', true,
      'projectId', v_grant.project_id,
      'versionId', v_grant.version_id,
      'versionNumber', v_grant.version_number,
      'audit_id', v_audit
    );
  end if;

  if v_grant.expires_at <= now() then
    raise exception 'Reel upload grant expired' using errcode = 'P0001';
  end if;

  update public.mil_reel_versions
  set
    storage_path = p_final_path,
    mime_type = coalesce(nullif(trim(p_mime_type), ''), mime_type),
    byte_size = p_byte_size
  where id = v_grant.version_id;

  update public.mil_reel_upload_grants
  set completed_at = now()
  where id = v_grant.id;

  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'reel_upload_completed:' || v_grant.version_id::text
  );

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    p_actor_id,
    'reel_upload_completed',
    'mil_reel_versions',
    v_grant.version_id,
    jsonb_build_object(
      'idempotency_key', v_key,
      'projectId', v_grant.project_id,
      'versionNumber', v_grant.version_number,
      'checksum', p_checksum,
      'byteSize', p_byte_size,
      'adoptedExistingFinal', v_adopted
    )
  )
  returning id into v_audit;

  return jsonb_build_object(
    'ok', true,
    'adopted', false,
    'projectId', v_grant.project_id,
    'versionId', v_grant.version_id,
    'versionNumber', v_grant.version_number,
    'audit_id', v_audit
  );
end;
$$;

create or replace function public.mil_unpublish_website_audited(
  p_actor_id uuid,
  p_asset_id uuid,
  p_details jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_count int;
  v_key text;
  v_audit uuid;
  v_cleanup jsonb;
begin
  if p_actor_id is null or p_asset_id is null then
    raise exception 'actor and asset required' using errcode = 'P0001';
  end if;

  perform 1
  from public.mil_website_promotions
  where asset_id = p_asset_id
    and unpublished_at is null
  for update;

  select array_agg(id order by promoted_at desc)
  into v_ids
  from public.mil_website_promotions
  where asset_id = p_asset_id
    and unpublished_at is null;

  if v_ids is null or coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'No active website promotion found for this asset'
      using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'promotionId', p.id,
    'derivativeId', p.derivative_id,
    'websiteMediaId', p.website_media_id
  )), '[]'::jsonb)
  into v_cleanup
  from public.mil_website_promotions p
  where p.id = any (v_ids);

  update public.mil_website_promotions
  set unpublished_at = now()
  where id = any (v_ids);
  get diagnostics v_count = row_count;

  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'website_unpublish:' || p_asset_id::text || ':' || p_actor_id::text
  );

  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (
    p_actor_id,
    'website_unpublish',
    'mil_assets',
    p_asset_id,
    coalesce(p_details, '{}'::jsonb) || jsonb_build_object(
      'idempotency_key', v_key,
      'unpublishedCount', v_count,
      'cleanup', v_cleanup
    )
  )
  returning id into v_audit;

  return jsonb_build_object(
    'ok', true,
    'unpublishedCount', v_count,
    'promotionIds', to_jsonb(v_ids),
    'cleanup', v_cleanup,
    'audit_id', v_audit
  );
end;
$$;

revoke all on function public.mil_mint_reel_upload_grant_audited(
  uuid, uuid, uuid, text, uuid, text, bigint, text, uuid, text, uuid
) from public, anon, authenticated;
revoke all on function public.mil_complete_reel_upload_audited(
  uuid, uuid, text, text, bigint, text, text
) from public, anon, authenticated;
revoke all on function public.mil_unpublish_website_audited(uuid, uuid, jsonb, text)
  from public, anon, authenticated;

grant execute on function public.mil_mint_reel_upload_grant_audited(
  uuid, uuid, uuid, text, uuid, text, bigint, text, uuid, text, uuid
) to service_role;
grant execute on function public.mil_complete_reel_upload_audited(
  uuid, uuid, text, text, bigint, text, text
) to service_role;
grant execute on function public.mil_unpublish_website_audited(uuid, uuid, jsonb, text)
  to service_role;

commit;
