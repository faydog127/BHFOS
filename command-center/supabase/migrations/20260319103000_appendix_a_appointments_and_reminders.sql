-- Appendix A: real appointment persistence + reminder automation surface

create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text,
  business_name text,
  email text,
  business_email text,
  phone text,
  website text,
  address text,
  logo_url text,
  primary_brand_color text default '#000000',
  service_area_radius integer default 25,
  service_zip_codes text[] default '{}'::text[],
  operating_hours jsonb default '{
    "monday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "tuesday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "wednesday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "thursday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "friday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "saturday":{"isOpen":false,"start":"10:00","end":"14:00"},
    "sunday":{"isOpen":false,"start":"10:00","end":"14:00"}
  }'::jsonb,
  time_zone text default 'America/New_York',
  default_currency text default 'USD',
  tax_rate numeric(10,2) default 0,
  default_tax_rate numeric(10,2) default 0,
  payment_terms text default 'Due on Receipt',
  appointment_slot_duration integer default 60,
  appointment_buffer_time integer default 15,
  appointment_lead_time_hours integer default 24,
  license_info text,
  additional_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_settings
  add column if not exists tenant_id text,
  add column if not exists business_name text,
  add column if not exists email text,
  add column if not exists business_email text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists logo_url text,
  add column if not exists primary_brand_color text default '#000000',
  add column if not exists service_area_radius integer default 25,
  add column if not exists service_zip_codes text[] default '{}'::text[],
  add column if not exists operating_hours jsonb default '{
    "monday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "tuesday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "wednesday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "thursday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "friday":{"isOpen":true,"start":"09:00","end":"17:00"},
    "saturday":{"isOpen":false,"start":"10:00","end":"14:00"},
    "sunday":{"isOpen":false,"start":"10:00","end":"14:00"}
  }'::jsonb,
  add column if not exists time_zone text default 'America/New_York',
  add column if not exists default_currency text default 'USD',
  add column if not exists tax_rate numeric(10,2) default 0,
  add column if not exists default_tax_rate numeric(10,2) default 0,
  add column if not exists payment_terms text default 'Due on Receipt',
  add column if not exists appointment_slot_duration integer default 60,
  add column if not exists appointment_buffer_time integer default 15,
  add column if not exists appointment_lead_time_hours integer default 24,
  add column if not exists license_info text,
  add column if not exists additional_notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'business_settings'
      and column_name = 'tenant_id'
  ) then
    execute 'create index if not exists business_settings_tenant_updated_idx on public.business_settings (tenant_id, updated_at desc)';
  end if;
end $$;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'tvg',
  lead_id uuid references public.leads(id) on delete set null,
  technician_id uuid references public.technicians(id) on delete set null,
  price_book_id uuid references public.price_book(id) on delete set null,
  service_name text not null,
  service_category text,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  arrival_window_start timestamptz,
  arrival_window_end timestamptz,
  duration_minutes integer not null default 120,
  status text not null default 'pending',
  service_address text,
  customer_notes text,
  admin_notes text,
  reminders_enabled boolean not null default true,
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists tenant_id text not null default 'tvg',
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists technician_id uuid references public.technicians(id) on delete set null,
  add column if not exists price_book_id uuid references public.price_book(id) on delete set null,
  add column if not exists service_name text,
  add column if not exists service_category text,
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists arrival_window_start timestamptz,
  add column if not exists arrival_window_end timestamptz,
  add column if not exists duration_minutes integer not null default 120,
  add column if not exists status text not null default 'pending',
  add column if not exists service_address text,
  add column if not exists customer_notes text,
  add column if not exists admin_notes text,
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_booking_verification()
returns trigger
language plpgsql
security definer
as $$
declare
  v_lead_email text;
  v_lead_name text;
begin
  -- Check if status changed from pending to confirmed (enum-safe).
  if old.status = 'pending' and new.status = 'confirmed' then
    select email, first_name
    into v_lead_email, v_lead_name
    from leads
    where id = new.lead_id;

    insert into marketing_actions (lead_id, action_type, status, subject_line, body)
    values (
      new.lead_id,
      'email',
      'pending',
      'Booking Confirmed: ' || to_char(new.scheduled_start, 'Mon DD, YYYY at HH:MI AM'),
      'Hi ' || coalesce(v_lead_name, 'there') || E',\n\n' ||
      'Your appointment has been officially confirmed for ' || to_char(new.scheduled_start, 'Mon DD, YYYY at HH:MI AM') || E'.\n\n' ||
      'Our technician will arrive within the 2-hour window. Please ensure someone over 18 is home.\n\n' ||
      'Thank you,\nThe Team'
    );
  end if;

  return new;
end;
$$;

update public.appointments
set
  service_name = coalesce(nullif(service_name, ''), pricing_snapshot->>'name', 'General Service'),
  duration_minutes = coalesce(nullif(duration_minutes, 0), 120),
  pricing_snapshot = coalesce(pricing_snapshot, '{}'::jsonb),
  reminders_enabled = coalesce(reminders_enabled, true),
  updated_at = coalesce(updated_at, now())
where
  service_name is null
  or service_name = ''
  or duration_minutes is null
  or duration_minutes = 0
  or pricing_snapshot is null
  or reminders_enabled is null
  or updated_at is null;

create index if not exists appointments_tenant_status_start_idx
  on public.appointments (tenant_id, status, scheduled_start);

create index if not exists appointments_lead_idx
  on public.appointments (lead_id);

create index if not exists appointments_technician_idx
  on public.appointments (technician_id, scheduled_start);
