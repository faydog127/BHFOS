# Runtime Validation — Environment Rules (Locked)

Current reality:
- No staging Supabase project.
- No staging n8n.
- No Stripe test-mode environment.

Therefore:

## Allowed write environments

1) **LOCAL (allowed to write)**
- Supabase local stack only (`FUNCTIONS_URL` must be `http://127.0.0.1` / `http://localhost`)
- OK to seed test records
- Prefer tagging invoices with `is_test_data=true`

## Disallowed write environments (until isolation exists)

2) **PROD (writes forbidden)**
- PROD is **READ-ONLY** until one of these is true:
  - a real staging environment exists, OR
  - an explicit PROD test-tenant + `is_test_data` strategy is approved

## Approval rule

- Any runtime run that could write outside LOCAL requires explicit approval (even if “it’s just a test”).

## Forbidden in PROD (unless explicitly approved)

- Triggering `public-pay`
- Sending invoices/emails/SMS
- Accepting quotes
- Running webhooks that mutate money state
- Applying migrations

