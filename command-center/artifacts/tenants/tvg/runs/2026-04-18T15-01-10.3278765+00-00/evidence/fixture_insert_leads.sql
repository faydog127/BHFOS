insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('df05a8a4-4fbb-4243-a174-0333cb541d77', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('52f3376b-a8cd-405b-bad8-284987077604', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
