-- DRIFT-001 (PROD): public.leads is missing updated_at but canonical migrations + app code assume it exists.
--
-- Canonical intent:
-- - supabase/migrations/20260101_create_money_loop_core_tables.sql defines public.leads.updated_at timestamptz not null default now()
--
-- Why this migration exists:
-- - PROD already has a legacy public.leads table, so CREATE TABLE IF NOT EXISTS cannot converge the shape.
-- - This is an additive, idempotent drift-fix migration to align PROD to canonical schema expectations.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'updated_at'
  ) then
    alter table public.leads
      add column updated_at timestamptz;

    -- Best-effort backfill: prefer last_touch_at when present, otherwise created_at.
    -- This keeps scheduling/customer ordering roughly correct without requiring a full historical reconstruction.
    update public.leads
      set updated_at = coalesce(last_touch_at, created_at, now())
      where updated_at is null;

    alter table public.leads
      alter column updated_at set default now();

    alter table public.leads
      alter column updated_at set not null;
  end if;
end $$;

