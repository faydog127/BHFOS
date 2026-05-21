insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('a4203dd8-dfd8-4192-b282-9fba980fad6e', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('f68bd6e5-d221-4c99-80d9-f2c45b0cf8e2', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
