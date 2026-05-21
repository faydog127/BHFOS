insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('538092bd-061b-468f-baae-7c6587d8d8a2', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('cf0e0133-080d-4e4f-9c7f-a4fb74b14a33', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
