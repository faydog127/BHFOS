-- Media Intelligence — scoped upload sessions + revocation helpers.
-- Single-company: no tenant_id.

begin;

create table if not exists public.mil_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.mil_upload_batches(id) on delete set null,
  token_hash text not null unique,
  label text,
  source_phone text,
  source_person text,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mil_upload_sessions_created_idx
  on public.mil_upload_sessions (created_at desc);

create index if not exists mil_upload_sessions_batch_idx
  on public.mil_upload_sessions (batch_id);

comment on table public.mil_upload_sessions is
  'Scoped upload-only phone sessions. Opaque token never stored — only sha256 hash. Revocable and short-lived.';

drop trigger if exists mil_upload_sessions_updated on public.mil_upload_sessions;
create trigger mil_upload_sessions_updated
  before update on public.mil_upload_sessions
  for each row execute function public.mil_touch_updated_at();

alter table public.mil_upload_sessions enable row level security;

drop policy if exists mil_staff_upload_sessions on public.mil_upload_sessions;
create policy mil_staff_upload_sessions on public.mil_upload_sessions
  for all to authenticated
  using (public.mil_is_staff())
  with check (public.mil_is_owner_admin());

create or replace function public.mil_upload_session_is_active(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mil_upload_sessions s
    where s.id = p_session_id
      and s.revoked_at is null
      and s.expires_at > now()
  );
$$;

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
  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (auth.uid(), 'upload_session_revoked', 'mil_upload_sessions', p_session_id, '{}'::jsonb);
  return found;
end;
$$;

revoke all on function public.mil_revoke_upload_session(uuid) from public;
grant execute on function public.mil_revoke_upload_session(uuid) to authenticated;

create or replace function public.mil_revoke_creator_assignment(p_assignment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mil_is_owner_admin() then
    raise exception 'Only owner/admin may revoke creator assignments';
  end if;
  update public.mil_creator_assignments
  set status = 'revoked', revoked_at = now()
  where id = p_assignment_id
    and status = 'active';
  insert into public.mil_audit_events (actor_user_id, action, target_type, target_id, details)
  values (auth.uid(), 'creator_assignment_revoked', 'mil_creator_assignments', p_assignment_id, '{}'::jsonb);
  return found;
end;
$$;

revoke all on function public.mil_revoke_creator_assignment(uuid) from public;
grant execute on function public.mil_revoke_creator_assignment(uuid) to authenticated;

commit;
