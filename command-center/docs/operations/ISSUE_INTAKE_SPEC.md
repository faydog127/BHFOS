# Issue Intake Spec (Minimum Viable)

Objective: centralized trouble tickets with enough structure to be actionable and auditable.

This spec is compatible with:
- ULSIA findings (static audit)
- RVH runs (runtime proof)
- Fix packets (`docs/handoff/FIX_PACKET_TEMPLATE.md`)

---

## Required fields (must have)

- **Title** (short, specific)
- **Severity** (P0/P1/P2/P3)
- **Environment** (LOCAL / STAGING / PROD / MULTI)
- **Issue class** (choose one):
  - System failure
  - Workflow/model failure
  - Integration failure
  - UX/usability failure
  - Observability gap
  - Security gap
  - Data integrity gap
- **What happened** (1–3 sentences)
- **Expected behavior** (1 sentence)
- **Reproduction steps** (smallest click-path/command path)
- **Evidence** (at least one):
  - exact error text (copy/paste)
  - screenshot (redacted)
  - log snippet (redacted)
- **Owner** (person accountable for next action)
- **Status** (see below)

## Optional but recommended fields

- **First seen** (date/time, timezone)
- **Frequency** (always / often / intermittent / once)
- **Customer impact** (who is blocked, what is blocked)
- **Related IDs** (redacted if needed): lead_id / quote_id / job_id / invoice_id
- **Related links**:
  - CRM URL (screen where observed)
  - Supabase function endpoint (if relevant)
  - n8n execution link (if relevant)

---

## Severity levels (use these exact meanings)

- **P0 = Revenue blocked**
  - cannot send invoices OR cannot accept payment OR payment reconciliation broken
- **P1 = Operations blocked**
  - cannot schedule OR cannot dispatch OR cannot create/complete work orders
- **P2 = Workflow broken but workaround exists**
  - can operate, but process is unreliable/slow/error-prone
- **P3 = Cosmetic/usability only**
  - layout, wording, non-blocking UX improvements

---

## Environment field (non-negotiable)

Pick exactly one:
- **LOCAL**
- **STAGING**
- **PROD**
- **MULTI** (only if reproduced in 2+ environments)

Rule: do not infer PROD behavior from LOCAL code.

---

## Repro steps (standard format)

Use numbered steps and include the starting point.

Example:
1) Open `https://app.bhfos.com/tvg/crm/dispatch`
2) Click work order `WO-2026-0064`
3) Click “Schedule Now”
4) Observe error: `column leads.updated_at does not exist`

For scripts/CLI:
1) Run `pwsh -File scripts/runtime/run-runtime-suite.ps1 -Environment local -StopAfter chainA`
2) Observe failure in `.../preflight.log`

---

## Screenshot/log attachment guidance

### Screenshots
- Crop to only what’s needed (avoid customer PII)
- Redact:
  - tokens
  - email addresses
  - phone numbers
  - street addresses

### Logs
- Include the smallest snippet that contains the error + context
- Never include secrets:
  - JWTs
  - Supabase anon/service keys
  - Stripe secret keys

---

## Owner

Owner = the person responsible for the **next action**, not “who caused it”.

---

## Status (allowed values)

- **New**
- **Needs Triage**
- **Blocked / Needs Access**
- **Accepted**
- **In Progress**
- **Ready for Validation**
- **Validated-Local**
- **Validated-Staging**
- **Released**
- **Closed**

---

## Artifact links

If this issue was found via audits or runtime runs, link artifacts:

- ULSIA artifacts (example):
  - `tmp/artifacts_index.md`
  - `tmp/rls_grants_scan.md`
- RVH artifacts (example):
  - `tmp/runtime/<date>/<env>/<run_id>/...`
- Fix packet:
  - `docs/handoff/<ISSUE_ID>_fix_packet.md` (or link to packet doc/location)

---

## Intake rules

- No ticket enters **Accepted** without required fields completed.
- Do not merge unrelated issues into one ticket.
- One primary failure per ticket.
- If you don’t have repro steps, mark as **Needs Triage** and assign an owner to reproduce.
- If blocked by access/secrets, mark **Blocked / Needs Access** and list the minimum unblock step.

---

## Triage rules (fast and strict)

When a new ticket arrives:
1) Confirm severity (P0/P1/P2/P3)
2) Confirm environment (LOCAL/STAGING/PROD/MULTI)
3) Confirm issue class
4) Confirm smallest repro steps exist
5) Decide next action:
   - create a fix packet (P0/P1)
   - schedule later (P2/P3)
   - request more info (Needs Triage)

Rule: P0 tickets must either:
- get a fix packet within the same day, OR
- be explicitly deferred with a written reason + trigger to resume.

---

## Invalid / incomplete tickets (reject or bounce back)

A ticket is invalid/incomplete if:
- missing severity or environment
- no repro steps and no owner assigned to reproduce
- only “it’s broken” with no evidence
- includes secrets/PII in attachments (must be redacted)
- combines multiple unrelated failures

Response:
- change status to **Needs Triage**
- request missing fields (minimum info needed)

