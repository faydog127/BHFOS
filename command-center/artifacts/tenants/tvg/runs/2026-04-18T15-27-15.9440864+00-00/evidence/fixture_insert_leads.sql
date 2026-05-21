insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('8bc0c6ed-3958-40e8-8b9c-d48a736d1a06', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('f4b57dcd-f26b-4634-9ccc-2457e8e49646', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
