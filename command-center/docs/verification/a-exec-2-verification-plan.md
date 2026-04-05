# A-EXEC-2 Stop Gate A-2 Verification Plan

Date: 2026-02-16
Environment: Local Supabase (command-center)

## Scope
Verify all A-EXEC-2 edge function hardening:
- Event emission completeness
- Suspension logic (conditional AutomationSuspended)
- Lead timestamp updates
- Entity type standardization
- Webhook security (tenant isolation, amount validation, idempotency)
- Job creation race protection
- Customer conversion timestamp preservation

## Prerequisites
- Local Supabase running (postgres:25432, API:25431)
- Stripe test keys configured
- Test data: 1 lead, 1 quote, 1 invoice

## Test Scenarios

### Scenario 1: Quote View Flow
**Action:** GET public-quote endpoint with token
**Expected:**
- ✅ QuoteViewed event emitted (once per time window)
- ✅ HumanSignalReceived event with normalized payload {signal_type: 'quote_view', source: 'public_link'}
- ✅ AutomationSuspended emitted ONLY if new suspension created
- ✅ Lead-level suspension created
- ✅ TaskCreated event emitted
- ✅ `leads.last_human_signal_at` updated
- ✅ Task created: "Quote Viewed – Follow Up"

**Verification SQL:**
```sql
-- Events
SELECT event_type, entity_type, actor_type, payload->>'signal_type' as signal_type
FROM events 
WHERE entity_id IN ('<quote_id>'::uuid, '<lead_id>'::uuid)
  AND event_type IN ('QuoteViewed', 'HumanSignalReceived', 'AutomationSuspended', 'TaskCreated')
ORDER BY created_at DESC;

-- Suspensions (should have 2: quote-level + lead-level)
SELECT entity_type, entity_id, reason, resumed_at IS NULL as active
FROM automation_suspensions
WHERE entity_id IN ('<quote_id>'::uuid, '<lead_id>'::uuid)
ORDER BY suspended_at DESC;

-- Lead timestamp
SELECT id, last_human_signal_at
FROM leads
WHERE id = '<lead_id>'::uuid;

-- Tasks
SELECT id, title, source_type, source_id, status
FROM crm_tasks
WHERE source_id = '<quote_id>'::uuid
ORDER BY created_at DESC;
```

### Scenario 2: Quote Acceptance Flow
**Action:** POST public-quote-approve with action=approved
**Expected:**
- ✅ QuoteAccepted event emitted
- ✅ Job created with status=UNSCHEDULED
- ✅ JobCreated event emitted (only on insert, not on race retry)
- ✅ TaskCreated event emitted for "Schedule Job"
- ✅ Lead status updated to 'scheduled'
- ✅ LeadUpdated event emitted
- ✅ Job unique constraint prevents duplicates

**Verification SQL:**
```sql
-- Job exists
SELECT id, status, quote_id, lead_id
FROM jobs
WHERE quote_id = '<quote_id>'::uuid;

-- Events
SELECT event_type, entity_type, entity_id
FROM events
WHERE event_type IN ('QuoteAccepted', 'JobCreated', 'TaskCreated', 'LeadUpdated')
  AND entity_id IN ('<quote_id>'::uuid, '<job_id>'::uuid, '<lead_id>'::uuid)
ORDER BY created_at DESC;

-- Lead status
SELECT id, status, updated_at
FROM leads
WHERE id = '<lead_id>'::uuid;

-- Tasks
SELECT id, title, source_type, source_id
FROM crm_tasks
WHERE source_type = 'job' AND source_id = '<job_id>'::uuid;
```

**Race Test:** Accept quote twice simultaneously → should only create 1 job, 1 JobCreated event

### Scenario 3: Invoice View Flow
**Action:** GET public-invoice endpoint with token
**Expected:**
- ✅ InvoiceViewed event emitted
- ✅ HumanSignalReceived with {signal_type: 'invoice_view', source: 'public_link'}
- ✅ AutomationSuspended conditional (only if new)
- ✅ Lead-level suspension + timestamp update
- ✅ TaskCreated event + task "Invoice Viewed – Follow Up"

**Verification SQL:** (Same structure as Scenario 1, replace quote → invoice)

### Scenario 4: Payment Initiation Flow
**Action:** POST public-pay with invoice token
**Expected:**
- ✅ Stripe PaymentIntent created
- ✅ `invoices.provider_payment_id` updated
- ✅ PaymentInitiated event with entity_type='payment', entity_id=intent.id
- ✅ HumanSignalReceived with {signal_type: 'payment_attempt', source: 'public_link'}
- ✅ Actor type = 'external_customer' (not 'public')
- ✅ Lead-level suspension + timestamp update

**Verification SQL:**
```sql
-- Invoice updated
SELECT id, provider_payment_id, provider_payment_status
FROM invoices
WHERE id = '<invoice_id>'::uuid;

-- Events (entity_id should be payment intent ID, not invoice ID)
SELECT event_type, entity_type, entity_id, actor_type, payload->>'signal_type' as signal_type
FROM events
WHERE event_type IN ('PaymentInitiated', 'HumanSignalReceived')
  AND (entity_id = '<payment_intent_id>' OR entity_id = '<invoice_id>'::uuid)
ORDER BY created_at DESC;

-- Lead timestamp
SELECT id, last_human_signal_at
FROM leads
WHERE id = '<lead_id>'::uuid;
```

### Scenario 5: Webhook Success Flow
**Action:** Simulate payment_intent.succeeded webhook
**Expected:**
- ✅ Idempotency guard (duplicate event_id returns 200 with duplicate:true)
- ✅ Tenant validation (mismatch returns 400)
- ✅ Amount validation (insufficient amount returns 400, emits PaymentAmountMismatch)
- ✅ Invoice updated to PAID only if not already PAID (conditional)
- ✅ PaymentSucceeded event (entity_type='payment', entity_id=intent.id)
- ✅ InvoicePaid event
- ✅ CustomerConvertedAuto event (preserves customer_created_at if already customer)
- ✅ LeadUpdated event ONLY if all invoices paid
- ✅ TaskCreated event for "Send Receipt" with requires_business_hours metadata

**Verification SQL:**
```sql
-- Idempotency
SELECT event_id, event_type, invoice_id, received_at
FROM stripe_webhook_events
WHERE event_id = '<event_id>';

-- Invoice status
SELECT id, status, paid_at, provider_payment_status
FROM invoices
WHERE id = '<invoice_id>'::uuid;

-- Customer conversion
SELECT id, is_customer, customer_created_at, manual_convert_reason
FROM contacts
WHERE id = '<contact_id>'::uuid;

-- Lead status (should be 'paid' only if ALL invoices paid)
SELECT id, status
FROM leads
WHERE id = '<lead_id>'::uuid;

-- All invoices for lead
SELECT id, status
FROM invoices
WHERE lead_id = '<lead_id>'::uuid;

-- Events
SELECT event_type, entity_type, entity_id, actor_type
FROM events
WHERE event_type IN ('PaymentSucceeded', 'InvoicePaid', 'CustomerConvertedAuto', 'LeadUpdated', 'TaskCreated')
  AND created_at > now() - interval '1 minute'
ORDER BY created_at DESC;

-- Task metadata
SELECT id, title, metadata
FROM crm_tasks
WHERE title = 'Send Receipt'
ORDER BY created_at DESC LIMIT 1;
```

**Edge Cases:**
1. Duplicate webhook (same event_id) → 200 response, no duplicate events
2. Tenant mismatch (intent.metadata.tenant_id ≠ invoice.tenant_id) → 400 error
3. Insufficient amount (intent.amount < invoice.balance_due) → 400 + PaymentAmountMismatch event
4. Already paid invoice → 200, no state change
5. Race condition (two webhooks for same invoice) → only first marks PAID

### Scenario 6: Webhook Failure Flow
**Action:** Simulate payment_intent.payment_failed webhook
**Expected:**
- ✅ PaymentFailed event emitted
- ✅ TaskCreated for "Payment Failed - Reconcile"
- ✅ Invoice NOT updated to PAID
- ✅ No customer conversion

### Scenario 7: Manual Customer Convert
**Action:** POST manual-convert-customer
**Expected:**
- ✅ CustomerConvertedManual event with entity_type='customer' (not 'contact')
- ✅ `contacts.is_customer` = true
- ✅ `contacts.customer_created_at` set
- ✅ Actor type = 'user'

### Scenario 8: Reversal/Unsupported Events
**Action:** Send charge.refunded webhook
**Expected:**
- ✅ 200 response
- ✅ PaymentReversedIgnored event emitted
- ✅ No invoice state change

**Action:** Send unsupported event type
**Expected:**
- ✅ 200 response
- ✅ UnhandledStripeEvent event emitted

## Success Criteria (Stop Gate A-2)
- ✅ All 18 original gap fixes verified
- ✅ All 5 additional gotcha fixes verified
- ✅ No runtime errors
- ✅ Event taxonomy correct (payment, customer, task - not payment_intent, contact)
- ✅ Actor types normalized (external_customer, system, provider, user)
- ✅ HumanSignalReceived payloads consistent {signal_type, source}
- ✅ Security validations enforce (tenant isolation, amount verification)
- ✅ Race conditions handled (idempotency, unique constraints)
- ✅ Null-safe operations (lead linkage, customer conversion)

## Next Steps After Verification
If A-2 passes:
- ✅ Document results in `a-exec-2.md`
- ➡️ Proceed to A-EXEC-3 (Now Queue + task integrity)
