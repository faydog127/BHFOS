# Golden Scenario Catalog (RVH)

Objective: canonical scenarios used for repeated runtime validation.

Rule: scenarios must be **repeatable**, **evidence-backed**, and **environment-safe**.

Environments:
- Prefer LOCAL first
- STAGING only after isolation exists
- PROD-READ-ONLY only for passive checks (no writes)

---

## 1) Revenue chain (P0) — Invoice → Pay → Paid

### Purpose
Prove the money loop works end-to-end and is safe under replay:
`Invoice → pay initiation → webhook → invoice paid state`

### Inputs (fixtures)
- tenant_id
- one test invoice with:
  - `is_test_data=true` (when available)
  - valid `public_token`
  - correct totals (subtotal/tax/total)
- (STAGING only) Stripe test keys + webhook secret configured

### Expected outputs
- pay initiation returns success (no 4xx/5xx)
- provider payment id is recorded (payment intent / session linkage)
- webhook receipt recorded (or logged)
- invoice status becomes `paid`
- balance is zeroed (or matches the payment)
- follow-up tasks are closed (if your system does that)

### Mandatory assertions
- invoice status == `paid` (or documented terminal state)
- exactly one financial effect for a replayed event (idempotent):
  - `transactions_count == 1` (or equivalent)
- webhook replay returns safe 200 OK and does not double-apply

### Evidence minimums
- run_id + environment
- invoice_id + redacted token
- provider ids (STAGING): session_id / payment_intent_id / event_id
- DB proof (query output or CRM view):
  - invoice paid state
  - transaction count
- artifact folder path

### Teardown expectation
- LOCAL/STAGING: delete/archival for seeded fixtures (prefer `is_test_data=true`)
- PROD-READ-ONLY: no teardown (no writes)

---

## 2) Scheduling chain (P1) — Calendar load → Create appointment → Reload

### Purpose
Prove scheduling is operational (not just UI presence):
`Calendar load → create appointment → persist → visible on reload`

### Inputs (fixtures)
- tenant_id
- one job/work order eligible for scheduling (or a dedicated scheduling fixture)

### Expected outputs
- calendar view load succeeds (no backend errors)
- appointment creation succeeds
- appointment persists and reappears after refresh/reload

### Mandatory assertions
- calendar load returns success (HTTP 200 or UI loads without error banner)
- appointment row exists in DB (id + timestamps)
- appointment is linked to the expected job/work order (if designed)

### Evidence minimums
- run_id + environment
- appointment_id + job_id/work_order_id
- screenshot of calendar entry (redact PII) OR query output proving persistence
- artifact folder path

### Teardown expectation
- LOCAL/STAGING: cancel/delete the appointment fixture (or archive)
- PROD-READ-ONLY: no writes; only verify existing appointments

---

## 3) Quote → Job → Dispatch (P1) — Acceptance produces dispatchable work

### Purpose
Prove the operational chain is intact:
`Quote accepted → Job created → required fields populated → dispatch visibility`

### Inputs (fixtures)
- tenant_id
- one quote with a valid public token (or internal accept flow)
- required fields must be known:
  - service address (or a defined propagation rule)
  - customer contact info (phone/email as required)

### Expected outputs
- quote acceptance succeeds (no 4xx/5xx)
- job/work order is created and linked to the quote
- dispatch board shows the job (or job is queryable via dispatch source)

### Mandatory assertions
- `jobs.quote_id == <quote_id>` exists
- job/work order has service_address populated OR explicit blocker recorded
- dispatch data source includes the job (or the reason it is excluded is recorded)

### Evidence minimums
- run_id + environment
- quote_id + job_id + work_order_number (if applicable)
- screenshot of dispatch card (redact PII) OR query output proving dispatch inclusion
- artifact folder path

### Teardown expectation
- LOCAL/STAGING: archive/cleanup seeded quote/job fixtures
- PROD-READ-ONLY: no writes

---

## 4) TIS sync/offline chain (P1/P2) — Field completion under network interruption

### Purpose
Prove real-world field execution reliability:
- offline data capture is not lost
- sync applies once (no duplicates)
- conflicts resolve deterministically

### Inputs (fixtures)
- one job/work order accessible in TIS
- one field-tech actor (test account)
- defined “completion action” (notes/photos/measurements/etc.)

### Expected outputs
- app queues the update while offline
- app syncs after reconnect
- server state matches the intended completion update
- no duplicate completion events/rows created

### Mandatory assertions
- offline queue exists (local device) and survives app restart (if applicable)
- sync produces exactly one server-side apply
- conflict behavior is documented if a server-side change occurs while offline

### Evidence minimums
- run_id + environment
- job/work order identifier
- timestamps: offline action time + sync apply time
- screenshots (redacted) and/or logs showing queue + sync completion
- artifact folder path for any captured logs

### Teardown expectation
- LOCAL/STAGING: revert/cleanup test completion markers if possible (or mark as test)
- PROD-READ-ONLY: do not perform offline completion tests unless explicitly approved and isolated

