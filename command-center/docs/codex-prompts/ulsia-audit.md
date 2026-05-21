# ULSIA — Unified, Evidence-First System Integrity Audit (Codex Prompt)

Use this as the **single entry point** for a one-sweep, multi-layer audit that is *execution-grade* (artifact-backed, line-level evidence, explicit blocked behavior).

## Prompt (copy/paste into Codex)

```text
Run a Unified, Evidence-First System Integrity Audit (ONE pass, multi-layer).

Mode:
- Audit only: do not change code, do not apply migrations, do not write to prod.
- You MAY run read-only commands and create local artifacts under tmp/ (schema dumps, inventories, logs).
- If any step would require writes, explicitly ask first and default to NO.
- If you cannot run terminal commands in this environment: output the exact commands to run, then STOP and wait for me to paste results before continuing.

System scope (treat as ONE connected chain):
1) Supabase (PROD vs migrations + edge functions)
2) CRM app (routes/UI/service layer)
3) TIS (search repo/root for a TIS directory; do not assume an absolute path)
4) n8n (local workflows + webhook contracts)

Non-negotiables:
- Do not print secrets/keys/tokens/DB URLs. Redact any sensitive values (show only last 4 chars if needed).
- Do not include customer PII in artifacts (names/emails/phones/addresses). If encountered, redact.
- Do not treat code existence as proof of working behavior.
- Do not infer PROD behavior from LOCAL code.
- DO NOT report code style, linting, formatting, or refactor suggestions. Report ONLY integrity, drift, logic breaks, and system risk.

Stop-and-wait protocol (brakes):
- You MUST stop after Phase 1 and wait for: "PROCEED TO PHASE 2"
- You MUST stop after Phase 3 and wait for: "PROCEED TO PHASE 4"

========================
PHASE 0 — AUDIT INTEGRITY
========================
0.0 Orient workspace (avoid monorepo blindspots):
- Output a shallow directory overview (e.g., list top-level folders; optionally tree depth 2).
- Identify where `src/`, `supabase/`, `tools/`, and any TIS folder live before assuming paths.

0.1 Confirm repo clean for audit:
- Run `git status --porcelain` and record output in tmp/audit_integrity.txt.
- If working tree is not clean, record it and continue, but label confidence accordingly.

0.2 Create an artifact index:
- Every artifact created must be listed in tmp/artifacts_index.md with:
  - filename
  - how generated (command)
  - what it proves / limits

==================================
PHASE 1 — ARTIFACTS (MUST DO FIRST)
==================================
A) Dump PROD schema to tmp/ via Supabase CLI:
   - `supabase db dump --linked --schema public --file tmp/prod_public.sql`
   - DO NOT read the entire SQL dump into context.
   - Use search/targeted reads only (e.g., `rg -n`/`grep` for table definitions, or small line-window reads).
   - Auth fallback: If this command fails, hangs, or prompts for login/linking:
     - Output the exact manual step needed (`supabase login`, `supabase link --project-ref <ref>`, etc.)
     - Label Phase 1A as BLOCKED
     - STOP (do not continue)

B) Inventory canonical schema (migrations):
   - list `supabase/migrations/` in order to tmp/migrations_index.txt

C) Inventory edge functions:
   - list `supabase/functions/*` to tmp/edge_functions_index.txt
   - for each, record entry file + key env assumptions (from code only) to tmp/edge_functions_notes.md

D) Inventory CRM route tree + key screens:
   - identify the scheduling/dispatch/invoice/pay flows in `src/`
   - output a short map to tmp/crm_route_map.md (route → component → key service calls)

E) Inventory n8n:
   - list `tools/n8n/workflows/*.json` to tmp/n8n_workflows_index.txt
   - for each workflow, note external writes (Drive/Supabase/webhooks) to tmp/n8n_workflows_notes.md
   - treat `.env.n8n` as configuration input; do not print secrets.
   - Assumption check: these JSON workflows must be exported/synced. If missing/empty/outdated, label N8N as NOT VERIFIED (or BLOCKED) and require manual n8n UI confirmation.
   - Also scan workflows for idempotency/replay protection (especially any payment/webhook handlers).

F) TIS:
   - Search for a TIS directory (do not assume `C:\BHFOS\TIS\`).
   - If not found or cannot be read: label TIS lane as BLOCKED and stop expanding TIS scope.
   - If present, inventory entry points that write to Supabase / CRM to tmp/tis_write_map.md.
   - Specifically look for: offline queuing logic, sync collision handling, and network-drop state preservation.

🛑 STOP HERE (end of Phase 1).
- Output `tmp/artifacts_index.md` (only), and a one-paragraph summary of what is READY vs BLOCKED.
- Wait for: "PROCEED TO PHASE 2"

=========================================
PHASE 2 — CANONICAL SCHEMA DRIFT (SUPABASE)
=========================================
Schema source-of-truth (NON-NEGOTIABLE):
- Treat `supabase/migrations/` as canonical schema.
- Every schema mismatch MUST be classified:
  A) DB drift (PROD differs from migrations) → remediation: apply missing migrations OR add explicit drift-fix migration
  B) Code drift (code expects columns not in migrations) → remediation: code fix OR explicitly-justified new migration proposal

Deliver a Drift Report table (write it to docs/handoff/DRIFT_REPORT_<YYYY-MM-DD>.md):
- table/column
- migration evidence (file:line)
- prod evidence (tmp/prod_public.sql:line)
- code evidence (file:line) if applicable
- classification (A/B)
- smallest safe remediation (proposal only)
- risk note
- validation steps

Security/RLS scan requirement:
- Produce tmp/rls_grants_scan.md listing every table where:
  - RLS is enabled or not (from schema dump)
  - any GRANT to anon/authenticated/service_role
  - whether explicit CREATE POLICY statements exist in canonical migrations

Token/ID contract scan requirement:
- Verify types + defaults across these tables:
  - invoices.public_token
  - quotes.public_token
  - public_payment_attempts.public_token
- Cross-check with edge functions that read/write them.

=================================
PHASE 3 — FAILURE CHAINS (RECONCILE)
=================================
Reconciliation rule:
- Per-layer facts must be collected first, then reconciled.
- Do not skip a layer because another layer appears to explain the issue.

Deep-focus failure chains (map end-to-end, not “feature exists”):
1) Invoice → Pay link → public invoice fetch → public pay initiation → Stripe session → webhook → invoice state update
2) Quote accepted → job created → service_address populated → dispatch visibility
3) Scheduling board load → DB queries/views → required columns (e.g., leads.updated_at)

For each chain, output:
- chain diagram (steps)
- inputs/outputs per step (IDs/tokens/state)
- where it can silently fail
- what logs/rows would prove success vs failure

STOP CONDITION:
- If any P0 is VERIFIED (revenue blocked), stop broadening scope and fully map that chain until the failure point is pinned with evidence.

🛑 STOP HERE (end of Phase 3).
- Output the failure-chain analyses + current P0/P1 list.
- Wait for: "PROCEED TO PHASE 4"

========================================
PHASE 4 — READ-ONLY PROD CONFIG CHECKS
========================================
Run read-only checks ONLY (no writes):
- If service role key exists locally, execute a temporary local script under tmp/ using plain `fetch` (Node) to query PostgREST:
  - global_config keys: payments_mode, auto_create_draft_invoice_on_acceptance, maintenance_mode, system_status
  - DO NOT print the key or full responses containing sensitive values.
  - Prefer printing only the specific keys + values (redacted if sensitive).
- After output is captured, delete the temporary script.
- If blocked by missing secrets/auth/service access: label BLOCKED and stop expanding runtime claims.

=================================
PHASE 5 — OUTPUT (AUDIT-GRADE)
=================================
For EVERY issue output EXACTLY:
- Label: VERIFIED / NOT VERIFIED / BLOCKED / NEW / OVERTURNED
- Severity: P0 / P1 / P2 / P3
- Environment: PROD / LOCAL / SUPABASE / N8N / TIS / MULTI
- Layer(s): Data Truth / CRM Control / TIS Execution / Integrations / Reconciliation
- Classification: system failure | workflow/model failure | integration failure | UX/usability | observability gap | data integrity gap | security gap
- Confidence: High / Medium / Low (based on artifact quality + environment access)
- Evidence:
  - file path + line OR tmp/prod_public.sql line OR command output snippet (1–3 lines)
- Smallest reproduction steps
- Cross-system impact
- Smallest safe remediation (proposal only)
- Validation steps

Deliverables:
1) Top 5 system truths (new + verified)
2) Full issue table (cross-layer)
3) Drift Report (as described above)
4) Hidden dependency map (what blocks what)
5) Cross-system failure chains
6) Fix order (P0 → P1 → P2)
7) Must-verify-at-runtime list (things repo-only cannot prove)

Blocked-state rule:
- If missing secrets/auth/service access blocks a runtime claim: label BLOCKED and STOP expanding scope (no scope drift).
```

## Notes

- This prompt is intentionally **artifact-first**. If artifacts aren’t produced, the audit is incomplete.
- Keep PROD verification **read-only**. Use LOCAL for any write-based smoke tests, if explicitly allowed later.
