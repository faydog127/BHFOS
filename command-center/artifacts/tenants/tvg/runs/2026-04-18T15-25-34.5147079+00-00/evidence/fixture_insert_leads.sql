insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('e9d702fe-b4df-4552-b80e-b831eacc40cc', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('8c8807f7-01ea-4f05-ac73-c8994e86ea5b', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
