begin;

-- Repair invoices RLS so authenticated tenant users can read/write invoices.
-- Without these policies, the UI will show zero invoices even when rows exist.

alter table public.invoices enable row level security;

drop policy if exists "Invoices are readable by tenant" on public.invoices;
drop policy if exists "Invoices are insertable by tenant" on public.invoices;
drop policy if exists "Invoices are updatable by tenant" on public.invoices;
drop policy if exists "Invoices are deletable by tenant" on public.invoices;
drop policy if exists "Invoices service role full access" on public.invoices;

create policy "Invoices are readable by tenant"
  on public.invoices
  for select
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Invoices are insertable by tenant"
  on public.invoices
  for insert
  to authenticated
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Invoices are updatable by tenant"
  on public.invoices
  for update
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  )
  with check (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Invoices are deletable by tenant"
  on public.invoices
  for delete
  to authenticated
  using (
    tenant_id = coalesce(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      auth.jwt() -> 'user_metadata' ->> 'tenant_id'
    )
  );

create policy "Invoices service role full access"
  on public.invoices
  for all
  to service_role
  using (true)
  with check (true);

-- Invoice items: enforce tenant boundary via the parent invoice.
alter table public.invoice_items enable row level security;

drop policy if exists "Invoice items readable by tenant" on public.invoice_items;
drop policy if exists "Invoice items insertable by tenant" on public.invoice_items;
drop policy if exists "Invoice items updatable by tenant" on public.invoice_items;
drop policy if exists "Invoice items deletable by tenant" on public.invoice_items;
drop policy if exists "Invoice items service role full access" on public.invoice_items;

create policy "Invoice items readable by tenant"
  on public.invoice_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
    )
  );

create policy "Invoice items insertable by tenant"
  on public.invoice_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
    )
  );

create policy "Invoice items updatable by tenant"
  on public.invoice_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
    )
  );

create policy "Invoice items deletable by tenant"
  on public.invoice_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.tenant_id = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() -> 'user_metadata' ->> 'tenant_id'
        )
    )
  );

create policy "Invoice items service role full access"
  on public.invoice_items
  for all
  to service_role
  using (true)
  with check (true);

commit;