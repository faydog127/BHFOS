# RUN_ID + Traceability Contract (RVH + Audits)

Objective: one run must be traceable end-to-end across systems without leaking secrets/PII.

Applies to:
- RVH runtime validation runs
- ULSIA audit artifacts (where a run id is used)

---

## Naming format

Required format:

`rvh_<chain>_<YYYYMMDD_HHMMSS>_<shortid>`

Examples:
- `rvh_p0-a_20260416_001530_9f2c1a`
- `rvh_p1-b_20260416_010110_43bd0e`
- `rvh_probes_20260416_011522_c8a0a1`

### Allowed characters

- lowercase letters `a-z`
- digits `0-9`
- underscore `_`
- hyphen `-`

Forbidden:
- spaces
- slashes
- quotes
- `?` `&` `#` (avoid URL parsing issues)

Length:
- 8–64 characters recommended (short enough to fit in metadata fields)

---

## Where `run_id` is mandatory

### 1) Runtime artifact folders (RVH)

Every RVH run must write artifacts to:

`tmp/runtime/<date>/<env>/<run_id>/`

Required files in that folder:
- `run.json`
- `artifacts_index.md`
- chain logs (redacted)

### 2) Validation reports / run logs

Every RVH run must create an entry in:
- `docs/runtime-validation/run-log.md` (copy block per run)

### 3) Webhook metadata (where supported)

If a webhook payload supports metadata, `run_id` must be included:
- Stripe test runs: include `run_id` in metadata and/or event payload used by harness
- n8n webhook triggers: include `run_id` in the posted JSON

---

## Where `run_id` is optional (but preferred)

### CRM metadata

If a CRM action/event supports metadata fields, store:
- `run_id`
- `chain` (e.g., `p0-a`)
- `environment` (LOCAL/STAGING/PROD-READONLY)

Do not add new required fields just to store `run_id`.

### Supabase rows

If tables already have `metadata jsonb` or a `run_id`-like column, store `run_id`.

Preferred locations (when present):
- `public.public_events.run_id`
- `public.public_payment_attempts.run_id`
- `public.events.payload.run_id` (if payload is used)

If no safe place exists, do not alter schema in a docs-only change; record `run_id` in artifacts only.

### n8n execution notes

When running n8n workflows manually or via webhook, store `run_id` in:
- execution notes (if available), or
- a dedicated field in the execution payload (e.g., `meta.run_id`)

---

## How to use `run_id` in each system

### Runtime artifact folders

Folder name must equal the `run_id`.

Example:
- `tmp/runtime/2026-04-16/local/rvh_p0-a_20260416_001530_9f2c1a/`

### Supabase / DB

If writing rows (LOCAL/STAGING only):
- attach `run_id` anywhere that is already designed for trace metadata
- ensure test fixtures are tagged (prefer `is_test_data=true` where available)

### Webhooks

Rules:
- `run_id` must be stable across retries/replays
- replay tests must reuse the same `run_id` so idempotency can be asserted

### Logs

Every runtime script should print:
- `Run ID: <run_id>`
- environment
- the first failure point (if any)

Never print:
- full tokens
- keys
- JWTs

---

## Redaction and safety rules

- `run_id` is not sensitive by itself, but it can become sensitive if it’s linked to PII.
- Never embed PII inside `run_id` (no customer names, emails, phone numbers, addresses).
- Never embed secrets/tokens in `run_id`.
- When referencing related tokens/keys in the same report, use redaction:
  - `abcd…wxyz` (first4…last4)

---

## Minimal trace tuple (what makes a run traceable)

Every RVH run must be able to produce this tuple (redacted):
- `run_id`
- `environment`
- `chain`
- primary entity id(s): invoice_id / quote_id / job_id (as applicable)
- provider ids (test only): checkout_session_id / payment_intent_id / stripe_event_id
- n8n execution id (if involved)
- artifact folder path

