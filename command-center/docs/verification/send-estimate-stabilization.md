# Send-Estimate / Public Approval Stabilization

Date: 2026-02-23

## Goal
Keep the customer approval workflow working even when the marketing site does not host app routes like `/quotes/:token` or `/quote-confirmation`.

## Changes Applied

### 1) `send-estimate` public quote link behavior
- File: `supabase/functions/send-estimate/index.ts`
- `buildPublicQuoteUrl` now uses `PUBLIC_QUOTE_BASE_URL` only for app quote links.
- If `PUBLIC_QUOTE_BASE_URL` is not configured, it falls back to Supabase-hosted `public-quote` HTML route.
- This prevents broken links like `https://vent-guys.com/quotes/:token` when that route is not deployed.

### 2) `public-quote-approve` confirmation behavior
- File: `supabase/functions/public-quote-approve/index.ts`
- Redirect to app confirmation page now occurs **only** when `PUBLIC_QUOTE_RESULT_URL` is explicitly set.
- If `PUBLIC_QUOTE_RESULT_URL` is missing, approval returns a hosted HTML confirmation page directly from the edge function (no broken redirect).
- Website/home links use `BUSINESS_WEBSITE` fallback.

### 3) Deployed functions
- `public-quote-approve`
- `send-estimate`

Project: `wwyxohjnyqnegzbxtuxs`

## Current Runtime Contract

### Safe defaults (works immediately)
- Do not set `PUBLIC_QUOTE_RESULT_URL` unless a real app confirmation route is deployed.
- Do not set `PUBLIC_QUOTE_BASE_URL` unless `/quotes/:token` is deployed on that domain.

With both unset:
- Email quote link -> Supabase `public-quote` HTML page
- Approve/Decline -> Supabase hosted confirmation page

### Full app experience (future)
Set these only after deployment exists:
- `PUBLIC_QUOTE_BASE_URL=https://<app-domain>`
- `PUBLIC_QUOTE_RESULT_URL=https://<app-domain>`

Then:
- Email quote link -> `<app-domain>/quotes/:token`
- Approve/Decline -> `<app-domain>/quote-confirmation?...`

## Retest Checklist
1. Send a new estimate email.
2. Open quote link from email.
3. Click Approve.
4. Confirm status updates to approved.
5. Confirm confirmation page shows success.
6. Confirm invoice is auto-created (DB + invoice list endpoint/UI).

