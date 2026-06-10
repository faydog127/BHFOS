insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('56266ceb-0755-43e6-a60e-5ce0bad25aea', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('ce0cf7b6-ad08-4141-9ba1-e54f3abd2bf6', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
