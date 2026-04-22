insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('4492ae0a-bdf7-4403-9b72-09b4ee078ec9', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('79be7bc5-d9b7-4201-b1dc-be0ca4e92114', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
