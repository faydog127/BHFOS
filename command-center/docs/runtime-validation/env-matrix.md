# Runtime Validation — Environment Matrix

## LOCAL

Allowed:
- Seed fixtures (DB writes)
- Call mutation edge functions
- Use explicit test bypass headers (where supported)
- Fault injection + replay/idempotency tests

Required proofs:
- `FUNCTIONS_URL` is `127.0.0.1` / `localhost`
- No secrets printed in logs/artifacts

## STAGING (not available yet)

Allowed (once it exists):
- Same as LOCAL

Required proofs (non-negotiable):
- Supabase project ref is NOT production
- Stripe keys are test keys
- Email sending disabled or routed to a designated test inbox

## PROD-READONLY

Allowed:
- Passive verification only (schema dump, read-only config reads, log reads, existing-record assertions)

Forbidden:
- Any endpoint that can create payment sessions, accept quotes, send emails, or mutate money/ops state

