# Autopilot Local Spec (Governance) — v2

Updated: 2026-04-05  
Scope: governance only (no runtime behavior change)

## Purpose
Define `autopilot:local` as the single local orchestration backbone for evidence-grade engineering execution.

It runs the local pipeline end-to-end, stops at the gate, and produces append-only artifacts for review.

## Core rule
`autopilot:local` is the local execution and evidence runner. It does not deploy, merge, or self-approve critical release decisions.

## Canonical Alignment (Must Match Repo Enforcement)

### Domain tags (authoritative list)
Must match `review-policy.json`:
- `tenant_isolation`
- `money_state`
- `acceptance_commit`
- `state_machine`
- `completion_gate`

### Gate integration
`autopilot:local` must generate/refresh a run-scoped `review-input.json` and then run:
- `npm run review:gate`

The gate is the local SSOT for review enforcement.

## Non-goals
`autopilot:local` does not:
- call production deployment targets
- merge branches automatically
- accept risk automatically
- label production validation without production artifacts
- replace human release authority in trigger domains

## Run folder contract (Common workspace)
Each invocation creates one run folder:

`artifacts/tenants/<tenant_id>/runs/<run_id>/`

### Required top-level artifacts
- `meta.json`
- `stdout.log`
- `stderr.log`
- `review-input.json`
- `result.json`
- `failure_packet.json` only on failure

### Suggested subfolders
- `logs/`
- `analysis/`
- `outputs/`
- `evidence/`
- `patches/`

## Required metadata (`meta.json`)
Must include at minimum:
- `run_id`
- `timestamp`
- `source_commit`
- `files_changed`
- `domain_tags_derived`
- `change_ref` or `pr_id` when available
- `derivation_inputs` (e.g., `git diff --name-only`)

## Operator quickstart (human runbook)
Prereqs:
- Local Supabase running (or the environment defined for local proof)
- Required env loaded for tests (see `tmp/handshake_next_chat.md`)

One-command intent:
- Run `autopilot:local` (when implemented) to produce a run folder and a gate PASS/FAIL.

Until implemented, local proof is executed via the focused runners in `supabase/tests/node/` and validated with `npm run review:gate`.

## Detection stage
`autopilot:local` determines what changed using:
- `git diff --name-only` against the target base when possible
- fallback to `git status --porcelain` only when necessary

## Domain-tag derivation
`autopilot:local` derives required domain tags from changed paths and records:
- derived tags
- derivation inputs
- mismatches between declared vs derived tags
- unmatched paths that require human review

## Proof-pack execution
For derived trigger domains, `autopilot:local` runs required local proof packs and captures outputs into the run folder.

## Result contract

### PASS
Write `result.json` with:
- run_id
- status
- readiness status/labels (must match gate schema)
- artifact pointers
- derived domain tags
- proof packs executed

### FAIL
Write `failure_packet.json` with:
- failed step
- error summary
- pointers to logs
- domain tags
- safe next action
- whether autonomous retry is allowed

## SSOT communication model
Roles do communicate in chat, but SSOT is the run folder:
- Chat is non-authoritative.
- Any decision, acceptance, or claim must be written back into artifacts.

## Proof linkage rule (anti “persuasive narrative”)
Every scenario and finding must link to:
- artifact path(s) in the run folder
- log or DB proof
- code reference where relevant

Without proof linkage, the submission is invalid.

## Security / privacy / retention rules (required)

### Secrets
- No secrets in artifacts (tokens/keys must be redacted).
- Failure packets must not include raw auth headers or full env dumps.

### PII minimization
- DB outputs should prefer IDs and minimal fields.
- Emails/phones/addresses only when strictly required and explicitly tagged as restricted.

### Artifact classification
- `public`: safe to share broadly
- `internal`: safe for team only
- `restricted`: contains PII or sensitive operational details; share requires decider approval

### Retention
- Define retention windows for runs (local/dev) and enforce purge/archive rules.
- Escalated runs (production incidents) may be retained longer with explicit approval.

## Circuit breaker
To prevent infinite self-heal loops:
- max 3 consecutive repair attempts per run for materially identical failure signature
- after threshold, stop and escalate
- write a blocker artifact (e.g., `BLOCKED_BY_RETRY_LIMIT.md` or structured equivalent)

## Concurrency model declaration
For any background/sweeper/async work reviewed within a run, the work must declare whether it is:
- `lock_based`
- `dedupe_based`

And must specify:
- guarantees
- non-guarantees

## Near-term enhancement (anti-tamper)
Add a run manifest with hashes:
- `manifest.json` lists SHA256 for each produced artifact file.
- Gate may later verify hashes to detect post-run edits.
