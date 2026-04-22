# Runtime Validation Harness (RVH) — v1.0

## Purpose

Prove **runtime behavior** end-to-end with:
- **Automated traces** (primary proof)
- **Visual sanity checks** (secondary UX confirmation)

RVH complements ULSIA:
- ULSIA = static integrity + drift detection (repo + migrations)
- RVH = dynamic proof + idempotency + evidence capture

## Environment modes

Run order:
1) **LOCAL** (writes allowed)
2) **STAGING** (writes allowed only if isolated from PROD)
3) **PROD-READONLY** (no writes; passive verification only)

Current constraint:
- If STAGING does not exist yet, RVH is **LOCAL (writes)** + **PROD-READONLY (no writes)**.

## Automated traces vs visual sanity checks

Automated traces (should be repeatable):
- seed fixtures deterministically
- call edge/API routes
- run idempotency/replay tests
- assert DB outcomes
- write artifacts

Visual sanity checks (operator confirmation):
- email rendering/readability
- pay page UX
- dispatch usability
- TIS field workflow under offline/sync conditions

## Preflight gates (must pass before any writes)

Use:
- `scripts/runtime/assert-env-safe.ps1`

Minimum gates:
- LOCAL: Supabase functions URL is `127.0.0.1`/`localhost`; edge runtime is running
- STAGING: explicit approval for remote writes; proof not PROD; Stripe test keys; email routed/disabled
- PROD-READONLY: writes forbidden by contract

## `run_id` contract

Every run must have a unique `run_id` and every artifact/run-log must reference it.

Recommended:
- `rvh_<chain>_<YYYYMMDD_HHMMSS>_<shortid>`

## Artifact requirements

Every run must produce:
- `run.json` (metadata; no secrets)
- `artifacts_index.md` (what was produced and why)
- chain logs (redacted)

Artifact folder:
- `tmp/runtime/<date>/<env>/<run_id>/`

## Teardown rule

- LOCAL/STAGING: teardown fixtures created by the harness (prefer `is_test_data=true` + archival; delete only if safe).
- PROD-READONLY: never teardown.

Teardown must be recorded in the run log.

## Blocked-state rule

If blocked by missing secrets/auth/service access or unclear source-of-truth:
1) record **BLOCKED** in `docs/runtime-validation/run-log.md`
2) propose the minimum unblock step
3) stop — do not expand scope

## Run commands (LOCAL)

Wrapper:
```powershell
pwsh -File scripts/runtime/run-runtime-suite.ps1 -Environment local -StopAfter probes
```

Stepwise:
- `-StopAfter preflight`
- `-StopAfter probes`
- `-StopAfter chainA`

## Package docs

- Environment rules: `docs/runtime-validation/environment-rules.md`
- Golden scenarios: `docs/runtime-validation/golden-scenarios.md`
- Env matrix: `docs/runtime-validation/env-matrix.md`
- Evidence requirements: `docs/runtime-validation/evidence-spec.md`
- RLS/public boundary checks: `docs/runtime-validation/rls-boundary-checks.md`
- Manual checklists: `docs/runtime-validation/manual-checklists.md`
- Run log format: `docs/runtime-validation/run-log.md`
