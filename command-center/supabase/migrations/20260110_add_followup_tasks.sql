alter table public.crm_tasks
    add column if not exists tenant_id text,
    add column if not exists owner_user_id uuid,
    add column if not exists lead_id uuid,
    add column if not exists source_type text,
    add column if not exists source_id uuid,
    add column if not exists type text,
    add column if not exists title text,
    add column if not exists due_at timestamptz,
    add column if not exists priority text,
    add column if not exists notes text,
    add column if not exists metadata jsonb default '{}'::jsonb,
    add column if not exists updated_at timestamptz;

create index if not exists crm_tasks_tenant_due_idx
    on public.crm_tasks (tenant_id, due_at);

create index if not exists crm_tasks_source_idx
    on public.crm_tasks (tenant_id, source_type, source_id);

create index if not exists crm_tasks_status_idx
    on public.crm_tasks (status);
