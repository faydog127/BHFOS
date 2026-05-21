# Workstreams (Where Things Live)

Purpose: keep you from getting lost when multiple tasks are in-flight across **CRM**, **TIS**, **n8n**, and **deploy tooling**.

This is a *map*, not a spec. When in doubt, generate a fresh snapshot with:

`pwsh -NoProfile -File scripts/workstream-status.ps1`

---

## 1) Command Center (CRM web app)

- **Main code:** `src/`
- **Build/dev:** `package.json` scripts (ex: `npm run dev`, `npm run build`)
- **High risk areas:** anything touching money state, invoices, payments, job completion.

---

## 2) Supabase (Edge functions + DB migrations + tests)

- **Edge functions:** `supabase/functions/`
- **Migrations:** `supabase/migrations/`
- **Node tests:** `supabase/tests/node/`

If a task mentions `lead-intake`, `send-email`, PDF generation, etc, it’s usually here.

---

## 3) TIS (Field app)

There are *two* TIS-related locations:

1) **Repo-local guardrails + docs**
   - Guardrails: `apps/tis/AGENTS.md`
   - Docs: `docs/tis/`
   - These exist to enforce the “TIS is independent” boundary.

2) **Actual TIS app codebase (separate repo on disk)**
   - `C:\BHFOS\TIS\`
   - This is outside `command-center`, so changes there are a separate workstream.

Deploy boundary reminder: TIS is expected to be independently deployable under `/tis/` and must not accidentally break the root CRM deploy.

---

## 4) n8n (Automation / “workflow orchestrator”)

- **Local docker compose:** `docker-compose.n8n.yml`
- **Local env template:** `.env.n8n.example` (copy → `.env.n8n`, do not commit)
- **Workflows (import into n8n UI):** `tools/n8n/workflows/`
- **Runbook:** `tools/n8n/README.md`
- **Cloud workflow patch helper:** `scripts/n8n-fix-review-board-processor.ps1`

If you’re thinking “multiple agents”, n8n is the right place to orchestrate: it can receive a payload, run OpenAI, enforce gates, and write outputs (ex: Google Drive).

---

## 5) Deploy tooling (Hostinger / multi-app deploy verification)

- Shared deploy helpers: `tools/deploy-lib.mjs`
- Live-vs-local compare: `tools/compare-hostinger-live.mjs`
- One-off deploy script(s): `tmp/deploy-hostinger-static.mjs` (and other `tmp/deploy-*`)

Rule of thumb:
- **`tools/`** = intended to be reused
- **`tmp/`** = experiments / one-off runs / artifacts

---

## 6) Orchestrator v2 (test-artifact judgment engine)

- Contracts + schemas: `tmp/orchestrator-v2/`
- Baseline notes: `docs/governance/BASELINE.md`

This is *not* n8n. It’s a repo-local “judge” for structured test artifacts (originally for deploy readiness).

---

## 7) Document system / governance

- Document library: `docs/document-library/`
- Governance rules/contracts: `docs/governance/`
- Review board contract source: `docs/review-board/Review-Board-Operating-System.txt`

If you’re unsure whether something is “allowed”, it’s probably governed here.

