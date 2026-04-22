# Fix Packet Template

Purpose: every remediation ships as a controlled, repeatable packet compatible with **ULSIA** (static audit) and **RVH** (runtime proof).

---

## 1) Issue ID
- ID:
- Links:
  - ULSIA item:
  - RVH chain/run (if applicable):

## 2) Title
- Short title:

## 3) Severity
- P0 / P1 / P2 / P3:

## 4) Environment
- Affected: LOCAL / STAGING / PROD / MULTI
- Target for fix + validation: LOCAL → STAGING → PROD (READ-ONLY until approved)

## 5) Layer(s)
- Data Truth (Supabase schema/migrations/RLS)
- CRM Control (app routes/UI/service layer)
- Execution (TIS)
- Integrations (n8n, Stripe, Resend, Calendar, etc.)
- Reconciliation (cross-system)

## 6) Root cause
- One paragraph max:
- Classification (schema-related only):
  - A) DB drift (prod missing what migrations define)
  - B) Code drift (code expects columns not in migrations)

## 7) Evidence
- Runtime error text (exact):
- Where observed (URL/screen/endpoint):
- Repro steps (smallest):
- Repo evidence (file path + line):
- DB evidence:
  - migration(s): `supabase/migrations/<id>_<name>.sql`
  - query/table/policy:
- RVH artifacts (if used):
  - `tmp/runtime/<date>/<env>/<run_id>/...`
- Notes on redaction (tokens/PII removed): YES/NO

## 8) Scope boundary
- IN SCOPE:
- OUT OF SCOPE:
- Explicit “do not touch” list (deploy scripts, unrelated modules, etc.):

## 9) Exact files/functions/tables affected
- Files:
  - `path/to/file.ext`
- Edge functions:
  - `supabase/functions/<function>/...`
- Tables/views/RPCs:
  - `public.<table>`
  - `public.<rpc>()`
- n8n workflows (if applicable):
  - `tools/n8n/workflows/<name>.json` (or “UI-only; exported on <date>”)

## 10) Proposed change
- Summary (what will change):
- Patch plan (ordered, smallest safe steps):
  1.
  2.
  3.
- Migration plan (if any):
  - New migration filename:
  - Why migration is warranted:
- Configuration/env changes (if any):
  - Var/key:
  - Where set (local, Supabase secrets, n8n creds, etc.):

## 11) Risks
- Primary risk:
- Side effects:
- Data integrity concerns:
- Security/RLS concerns:

## 12) Validation steps
- Preflight gates:
  - `scripts/runtime/assert-env-safe.ps1` (env must match contract)
- Automated checks:
  - RVH chain(s): (list exact commands + expected PASS signals)
- Manual checks (only if necessary):
  - Checklist reference: `docs/runtime-validation/manual-checklists.md`
- DB assertions:
  - Exact query + expected result:

## 13) Rollback plan
- Code rollback:
  - Revert commit(s) / patch:
- DB rollback:
  - Down migration strategy (or compensating migration):
- Operational rollback:
  - Disable feature flag / revert config:

## 14) Status
- Current: Proposed / Approved / In Progress / Ready for Review / Validated-Local / Validated-Staging / Released / Blocked
- Blockers (if any):
- Next action:

## 15) Owner
- Owner:
- Reviewer:
- Date opened:
- Date closed:

