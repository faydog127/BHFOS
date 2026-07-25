-- MIL schema contract tests (run after migrations apply)
-- Usage: psql "$DATABASE_URL" -f supabase/tests/mil/00_schema_contract.sql
-- Or: npx supabase db reset && psql postgresql://postgres:postgres@127.0.0.1:25432/postgres -f supabase/tests/mil/00_schema_contract.sql
--
-- These are plain SQL assertions (no pgTAP extension required). Each block raises
-- an exception on failure. Requires migrations 20260725120000 through 20260725150000.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1. mil_derivatives.kind includes public_safe and ai_safe
-- ---------------------------------------------------------------------------
do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(c.oid)
  into v_def
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'mil_derivatives'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%kind%';

  if v_def is null then
    raise exception 'mil_derivatives kind check constraint not found';
  end if;
  if v_def not ilike '%public_safe%' or v_def not ilike '%ai_safe%' then
    raise exception 'mil_derivatives.kind check must include public_safe and ai_safe; got: %', v_def;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. customer_permission gate language on mil_assets + permitted-use trigger
-- ---------------------------------------------------------------------------
do $$
declare
  v_asset_def text;
  v_fn_src text;
begin
  select pg_get_constraintdef(c.oid)
  into v_asset_def
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'mil_assets'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%customer_permission_status%';

  if v_asset_def is null then
    raise exception 'mil_assets customer_permission_status check not found';
  end if;
  if v_asset_def not ilike '%confirmed%'
     or v_asset_def not ilike '%not_required%'
     or v_asset_def not ilike '%unknown%' then
    raise exception 'customer_permission_status check missing expected values; got: %', v_asset_def;
  end if;

  select pg_get_functiondef(p.oid)
  into v_fn_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mil_enforce_public_use_gates';

  if v_fn_src is null then
    raise exception 'mil_enforce_public_use_gates() not found';
  end if;
  if v_fn_src not ilike '%customer_permission_status not in (''confirmed'', ''not_required'')%' then
    raise exception 'mil_enforce_public_use_gates must block marketing uses when customer_permission is unknown';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. mil_finalize_upload_grant exists and is service_role only
-- ---------------------------------------------------------------------------
do $$
declare
  v_proacl text;
begin
  if to_regprocedure('public.mil_finalize_upload_grant(uuid,text,text,bigint,boolean,uuid)') is null then
    raise exception 'public.mil_finalize_upload_grant(uuid,text,text,bigint,boolean,uuid) not found';
  end if;

  select array_to_string(p.proacl, ',')
  into v_proacl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mil_finalize_upload_grant';

  if v_proacl is null or v_proacl not ilike '%service_role%' then
    raise exception 'mil_finalize_upload_grant must be granted to service_role; proacl=%', v_proacl;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. No active mil_staff_all* RLS policies (capability matrix replaces them)
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
  v_names text;
begin
  select count(*), string_agg(policyname, ', ' order by policyname)
  into v_count, v_names
  from pg_policies
  where schemaname = 'public'
    and (
      policyname like 'mil_staff_all%'
      or policyname = 'mil_staff_all'
    );

  if v_count > 0 then
    raise exception 'Found forbidden mil_staff_all policies: %', v_names;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. mil_is_reviewer excludes office (admin, manager, media_reviewer only)
-- ---------------------------------------------------------------------------
do $$
declare
  v_src text;
begin
  select pg_get_functiondef(p.oid)
  into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mil_is_reviewer';

  if v_src is null then
    raise exception 'mil_is_reviewer() not found';
  end if;
  if v_src not ilike '%media_reviewer%' then
    raise exception 'mil_is_reviewer must include media_reviewer';
  end if;
  if v_src ilike '%office%' then
    raise exception 'mil_is_reviewer must NOT include office';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. mil_can_browse_library includes office (browse/upload staff)
-- ---------------------------------------------------------------------------
do $$
declare
  v_src text;
begin
  select pg_get_functiondef(p.oid)
  into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mil_can_browse_library';

  if v_src is null then
    raise exception 'mil_can_browse_library() not found';
  end if;
  if v_src not ilike '%office%' then
    raise exception 'mil_can_browse_library should include office for browse/upload';
  end if;
end $$;

select 'mil 00_schema_contract: PASS' as result;
