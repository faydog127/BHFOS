-- SQL-first addendum: richer idempotency with replay semantics.
-- Assumes PostgreSQL.

create table if not exists idempotency_keys (
  idempotency_key text primary key,
  operation text not null,
  request_hash text not null,
  status text not null check (status in ('in_progress', 'completed', 'failed')),
  response_json jsonb null,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_idempotency_keys_operation on idempotency_keys (operation);
create index if not exists idx_idempotency_keys_status on idempotency_keys (status);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_idempotency_keys_set_updated_at on idempotency_keys;
create trigger trg_idempotency_keys_set_updated_at
before update on idempotency_keys
for each row
execute function set_updated_at();

-- DB-backed begin/complete functions (enables deterministic concurrency behavior + testability).
-- - begin() will block on concurrent callers via FOR UPDATE and return the completed response on replay.

create or replace function idempotency_begin(
  p_idempotency_key text,
  p_operation text,
  p_request_hash text
)
returns jsonb
language plpgsql
as $$
declare
  v_row record;
begin
  insert into idempotency_keys (idempotency_key, operation, request_hash, status)
  values (p_idempotency_key, p_operation, p_request_hash, 'in_progress');

  return jsonb_build_object('kind', 'new');
exception
  when unique_violation then
    select *
      into v_row
      from idempotency_keys
     where idempotency_key = p_idempotency_key
     for update;

    if v_row is null then
      raise exception 'Idempotency key conflict but row missing: %', p_idempotency_key;
    end if;

    if v_row.operation <> p_operation or v_row.request_hash <> p_request_hash then
      raise exception 'Idempotency key reuse mismatch: %', p_idempotency_key
        using errcode = 'P0001';
    end if;

    if v_row.status = 'completed' then
      return jsonb_build_object('kind', 'replay', 'response', v_row.response_json);
    end if;

    -- If a row is left in_progress (should be rare), callers should treat as duplicate/in-progress.
    return jsonb_build_object('kind', 'in_progress');
end;
$$;

create or replace function idempotency_complete(
  p_idempotency_key text,
  p_response jsonb
)
returns void
language plpgsql
as $$
begin
  update idempotency_keys
     set status = 'completed',
         response_json = p_response
   where idempotency_key = p_idempotency_key;

  if not found then
    raise exception 'Idempotency key not found for complete: %', p_idempotency_key;
  end if;
end;
$$;
