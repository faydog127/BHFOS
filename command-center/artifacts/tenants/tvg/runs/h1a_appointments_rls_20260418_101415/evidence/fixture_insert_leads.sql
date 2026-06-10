insert into public.leads (id, tenant_id, first_name, last_name, email, phone)
values
  ('51e89728-53f6-4745-89b2-46e566edc43c', 'tvg', 'H1a', 'LeadA', 'h1a-lead-a@example.com', '555-0001'),
  ('f9023ac0-2197-4615-bd02-307e3533e65a', 'other-tenant', 'H1a', 'LeadB', 'h1a-lead-b@example.com', '555-0002')
on conflict (id) do nothing;
