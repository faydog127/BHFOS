# RVH Evidence Spec (v1)

Rule: evidence must be traceable without leaking secrets/PII.

## Required evidence tuple (per run)

- `run_id`
- `environment` (LOCAL | STAGING | PROD-READONLY)
- `chain_id` (RVH-P0-A / RVH-P1-B / RVH-P1-C)
- `invoice_id` / `quote_id` / `job_id` (as applicable)
- `public_token` redacted (first 4 + last 4 only)
- Stripe identifiers (STAGING only unless explicitly approved):
  - `checkout_session_id`
  - `provider_payment_id` (PaymentIntent)
  - `event_id`
- n8n execution id (if involved)
- Supabase rows touched + timestamps (invoice update, transaction insert, webhook receipt)
- Edge function name(s) invoked + UTC time window for logs

## Redaction rules

- Never store or paste:
  - JWTs
  - Supabase anon/service keys
  - Stripe secret keys
  - full public tokens
  - customer email/phone/address

Acceptable token format:
- `abcd…wxyz`

