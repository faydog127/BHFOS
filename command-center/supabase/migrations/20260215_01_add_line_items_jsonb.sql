-- A-EXEC-1 / A-DB-04: Add line_items JSONB columns and sync from item tables.
-- Additive-only, idempotent where possible.

-- -------------------------------
-- Columns
-- -------------------------------

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quotes'
      and column_name = 'line_items'
  ) then
    alter table public.quotes
      add column line_items jsonb not null default '[]'::jsonb;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'line_items'
  ) then
    alter table public.invoices
      add column line_items jsonb not null default '[]'::jsonb;
  end if;
end $$;

-- -------------------------------
-- Optional CHECK constraint (jsonb array)
-- -------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_line_items_is_array'
  ) then
    alter table public.quotes
      add constraint quotes_line_items_is_array
      check (jsonb_typeof(line_items) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_line_items_is_array'
  ) then
    alter table public.invoices
      add constraint invoices_line_items_is_array
      check (jsonb_typeof(line_items) = 'array');
  end if;
end $$;

-- -------------------------------
-- Backfill from item tables
-- -------------------------------

update public.quotes q
set line_items = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', qi.id,
        'description', qi.description,
        'quantity', qi.quantity,
        'unit_price', qi.unit_price,
        'total_price', qi.total_price
      ) order by qi.created_at, qi.id
    )
    from public.quote_items qi
    where qi.quote_id = q.id
  ),
  '[]'::jsonb
)
where q.line_items is null or q.line_items = '[]'::jsonb;

update public.invoices i
set line_items = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', ii.id,
        'description', ii.description,
        'quantity', ii.quantity,
        'unit_price', ii.unit_price,
        'total_price', ii.total_price
      ) order by ii.created_at, ii.id
    )
    from public.invoice_items ii
    where ii.invoice_id = i.id
  ),
  '[]'::jsonb
)
where i.line_items is null or i.line_items = '[]'::jsonb;

-- -------------------------------
-- Sync helpers and triggers (one-way: items -> JSONB)
-- -------------------------------

create or replace function public.rebuild_quote_line_items(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quote_id is null then
    return;
  end if;

  update public.quotes q
  set line_items = coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', qi.id,
          'description', qi.description,
          'quantity', qi.quantity,
          'unit_price', qi.unit_price,
          'total_price', qi.total_price
        ) order by qi.created_at, qi.id
      )
      from public.quote_items qi
      where qi.quote_id = p_quote_id
    ),
    '[]'::jsonb
  )
  where q.id = p_quote_id;
end $$;

create or replace function public.rebuild_invoice_line_items(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_invoice_id is null then
    return;
  end if;

  update public.invoices i
  set line_items = coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', ii.id,
          'description', ii.description,
          'quantity', ii.quantity,
          'unit_price', ii.unit_price,
          'total_price', ii.total_price
        ) order by ii.created_at, ii.id
      )
      from public.invoice_items ii
      where ii.invoice_id = p_invoice_id
    ),
    '[]'::jsonb
  )
  where i.id = p_invoice_id;
end $$;

create or replace function public.trg_quote_items_sync_line_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_quote_line_items(old.quote_id);
    return old;
  end if;

  perform public.rebuild_quote_line_items(new.quote_id);
  return new;
end $$;

create or replace function public.trg_invoice_items_sync_line_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_invoice_line_items(old.invoice_id);
    return old;
  end if;

  perform public.rebuild_invoice_line_items(new.invoice_id);
  return new;
end $$;

-- Triggers

drop trigger if exists trg_quote_items_sync_line_items on public.quote_items;
create trigger trg_quote_items_sync_line_items
after insert or update or delete on public.quote_items
for each row execute function public.trg_quote_items_sync_line_items();

drop trigger if exists trg_invoice_items_sync_line_items on public.invoice_items;
create trigger trg_invoice_items_sync_line_items
after insert or update or delete on public.invoice_items
for each row execute function public.trg_invoice_items_sync_line_items();

-- -------------------------------
-- Verification (run manually)
-- -------------------------------
-- select table_name, column_name, data_type, column_default
-- from information_schema.columns
-- where table_name in ('quotes','invoices') and column_name = 'line_items';
--
-- select id, jsonb_typeof(line_items) as line_items_type
-- from public.quotes
-- where line_items is not null
-- limit 5;
--
-- select q.id, q.line_items, v.line_items as view_items
-- from public.quotes q
-- join public.quote_line_items v on v.quote_id = q.id
-- limit 5;
--
-- select i.id, i.line_items, v.line_items as view_items
-- from public.invoices i
-- join public.invoice_line_items v on v.invoice_id = i.id
-- limit 5;
--
-- select
--   (select count(*) from public.quotes) as quotes_count,
--   (select count(*) from public.invoices) as invoices_count;
