# Write-Surface Matrix (by Environment)

Objective: prevent accidental production pollution during runtime validation.

Rule: if a run violates this matrix, it must be **blocked** (do not “try anyway”).

---

## Matrix

### LOCAL (writes allowed)

Allowed writes:
- Seed fixtures in DB (test records only)
- Call mutation edge functions (appointments, quote approval, pay initiation, webhook simulation)
- Run replay/idempotency tests
- Write artifacts under `tmp/runtime/...`

Forbidden writes:
- None, except writing secrets/PII into artifacts or logs

Payment rules:
- Allowed to exercise payment initiation paths
- Preferred: local test bypasses where implemented
- If Stripe is used: must be test keys only

Email rules:
- Allowed only if routed to local dev inbox / test sink (e.g., Mailpit) or explicitly mocked
- No real customer emails

Webhook rules:
- Allowed to simulate webhooks
- Replay tests permitted

Cleanup expectations:
- Required: teardown or archival of seeded fixtures (prefer `is_test_data=true`)
- Record teardown in `docs/runtime-validation/run-log.md`

---

### STAGING (writes allowed only if isolated)

Precondition (non-negotiable):
- Staging must be isolated from PROD (separate Supabase project and n8n instance)

Allowed writes:
- Same as LOCAL, but only against staging systems

Forbidden writes:
- Any write that targets production services (Supabase, n8n, Stripe live mode, Resend production)

Payment rules:
- Stripe must be in test mode
- Stripe keys must be test keys
- All payment-related writes must be tagged as test (where schema supports it)

Email rules:
- Email sending must be disabled OR forced to a designated test inbox/domain
- Bounce/suppression events should be treated as test-only

Webhook rules:
- Webhooks may be forwarded into staging only (no forwarding to prod endpoints)
- Replay/idempotency tests required for P0 money paths

Cleanup expectations:
- Required teardown/archival of seeded fixtures
- No staging data should be “left behind” unless explicitly approved

---

### PROD-READ-ONLY (writes forbidden)

Allowed writes:
- None

Allowed actions (passive only):
- Schema dump / read-only queries
- Read-only config checks
- Read-only log reads
- Existing-record assertions that do not mutate state

Forbidden writes (explicit denylist):
- Trigger `public-pay` (can create sessions/attempt rows)
- Send invoices, receipts, estimates, SMS
- Accept quotes / approve quotes
- Create or update appointments
- Create or modify jobs/work orders
- Invoke webhooks that change money state (Stripe webhook, payment-webhook)
- Apply migrations
- Backfills, cleanup scripts, or “quick fixes” that update data
- Any n8n workflow run that writes into production DB

Payment rules:
- Do not test payments in production during RVH (unless explicitly approved with a dedicated test tenant + isolation plan)

Email rules:
- Do not send test emails to real customers
- Do not “test deliverability” using production recipients

Webhook rules:
- Do not replay webhooks into production
- Do not forward Stripe events into production unless explicitly approved for a controlled incident response

Cleanup expectations:
- No cleanup actions are permitted because no write actions are permitted

---

## Blocking unsafe runs (rule)

Any RVH run must be blocked if:
- environment is PROD and any step would write
- environment is STAGING but isolation cannot be proven
- artifacts/logs would contain secrets/tokens/PII
- payment mode is not explicitly test-safe (where applicable)

Blocking response:
1) Mark run as **BLOCKED**
2) Record minimum unblock step
3) Stop (no scope expansion)

