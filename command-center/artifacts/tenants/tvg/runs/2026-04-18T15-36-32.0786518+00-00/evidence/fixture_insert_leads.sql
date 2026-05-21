insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('c6b7c5cd-926b-41dc-a795-dbefd0e3d768', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('fb17c74f-8f97-4fe7-ac7f-d909aa541fc6', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
