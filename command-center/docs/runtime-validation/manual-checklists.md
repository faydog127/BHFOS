# Manual Runtime Checklists (Secondary)

Manual checks are **visual sanity checks** and operator UX validation. They do **not** replace automated traces.

## RLS boundary proving (required)

Goal: prove public/anon surfaces do not leak data or allow unintended mutation.

- [ ] `public-invoice` with invalid token returns 404/denied (no PII leak)
- [ ] `public-invoice` with valid token returns only that invoice
- [ ] No anon endpoint can enumerate invoices/jobs/customers (no list endpoints exposed to anon)
- [ ] Webhook endpoints reject unsigned requests unless in LOCAL test-bypass mode

## Revenue chain (P0) — Invoice → Pay → Paid

- [ ] Customer-facing invoice view renders (amount + identity correct)
- [ ] Pay link opens the correct invoice (token scoped)
- [ ] Pay initiation succeeds (no 4xx/5xx)
- [ ] Payment completion path is confirmed (LOCAL: simulated; STAGING: Stripe test; PROD: not allowed unless approved)
- [ ] Invoice shows paid state in CRM (or equivalent UI)

Deliverability/observability (if email is used):
- [ ] Provider message id captured (redacted)
- [ ] Delivery state checked (delivered/bounced/suppressed) OR explicitly recorded as an observability gap

Evidence (minimum):
- Screenshot of invoice identity + amount (redact token + PII)
- Browser console export (redact tokens)
- DB proof or CRM proof: invoice status is `paid` (or expected terminal state)

## Scheduling chain (P1) — Calendar UX

- Required scheduling contract (must be true before a job can be “scheduled”):
  - `job.service_address` is non-null / non-empty
  - `job.scheduled_start` is set (timestamp)
  - `job.technician_id` is set (assignment)
- Execution readiness contract (do **not** treat “approved” as “ready”):
  - Quote Approved/Accepted → job created in `unscheduled`
  - “Ready for execution” is only true after scheduled time + tech assignment + address + minimum execution data are present

- [ ] Calendar loads without backend errors
- [ ] Create appointment succeeds
- [ ] Reload shows appointment
- [ ] Appointment shows correct time + job linkage (if applicable)

Evidence:
- Screenshot of calendar entry (redact PII)

## Quote → Job → Dispatch (P1)

- [ ] Quote acceptance produces a job
- [ ] Job has required fields populated (service address, phone, etc.)
- [ ] Job/work order is visible in dispatch
- [ ] Dispatch actions do not error (assign tech / schedule / mark status)

Evidence:
- Screenshot of dispatch card (redact customer PII)

## TIS sync/offline (P1/P2) — Field execution reality

Offline scenario:
- [ ] Open a job/work order in TIS
- [ ] Enable airplane mode (or disconnect network)
- [ ] Perform a completion action (notes/photos/measurements/etc.)
- [ ] Confirm the app queues the change locally (no data loss)
- [ ] Restore network and sync
- [ ] Confirm server-side state updates exactly once (no duplicates)

Collision scenario (optional but recommended):
- [ ] Change the same job field in CRM while TIS is offline
- [ ] Sync TIS after reconnect
- [ ] Confirm conflict handling is deterministic (document the rule) and no silent data loss occurs

Evidence:
- Timestamped screenshots (redact PII)
- Any sync/job ids involved
- If available: server-side event/log entry showing the sync apply
