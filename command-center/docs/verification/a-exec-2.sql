-- A-EXEC-2 Stop Gate A-2 Verification Pack (SQL)
-- Replace placeholders (<>).

-- 1) Quote view events
select event_type, entity_type, entity_id, created_at
from public.events
where entity_id = '<quote_id>'::uuid
  and event_type in ('QuoteViewed','HumanSignalReceived','AutomationSuspended','TaskCreated')
order by created_at desc;

-- 2) Invoice view events
select event_type, entity_type, entity_id, created_at
from public.events
where entity_id = '<invoice_id>'::uuid
  and event_type in ('InvoiceViewed','HumanSignalReceived','AutomationSuspended','TaskCreated')
order by created_at desc;

-- 3) Quote accept -> job created + task
select event_type, entity_type, entity_id, created_at
from public.events
where entity_id in ('<quote_id>'::uuid,'<job_id>'::uuid)
  and event_type in ('QuoteAccepted','JobCreated','TaskCreated','LeadUpdated')
order by created_at desc;

-- 4) Payment initiate -> events
select event_type, entity_type, entity_id, created_at
from public.events
where entity_id = '<invoice_id>'::uuid
  and event_type in ('PaymentInitiated','HumanSignalReceived')
order by created_at desc;

-- 5) Webhook success -> events
select event_type, entity_type, entity_id, created_at
from public.events
where entity_id in ('<invoice_id>'::uuid,'<lead_id>'::uuid,'<customer_id>'::uuid)
  and event_type in ('PaymentSucceeded','InvoicePaid','CustomerConvertedAuto','LeadUpdated','TaskCreated')
order by created_at desc;

-- 6) Webhook failure -> events
select event_type, entity_type, entity_id, created_at
from public.events
where entity_id = '<invoice_id>'::uuid
  and event_type in ('PaymentFailed','TaskCreated','AutomationSuspended')
order by created_at desc;

-- 7) Lead status verification
select id, status, updated_at
from public.leads
where id = '<lead_id>'::uuid;

-- 8) Invoice status verification
select id, status, paid_at, provider_payment_id, provider_payment_status
from public.invoices
where id = '<invoice_id>'::uuid;
