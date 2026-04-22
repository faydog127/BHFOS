insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('ce993164-f748-47d8-903a-9787e11cc98a', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('76dfbca5-4bec-4ea2-85dc-6ab8dee2feb9', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
