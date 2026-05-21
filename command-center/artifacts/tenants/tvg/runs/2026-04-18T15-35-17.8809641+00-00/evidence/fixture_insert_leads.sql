insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('4c6861f7-0699-4922-a3de-e0aea66b8412', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('dd6f37d9-6a0a-46ed-ae91-9333477e8a51', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
