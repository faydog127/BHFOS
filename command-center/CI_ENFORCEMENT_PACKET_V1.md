# CI_ENFORCEMENT_PACKET_V1.md

## Purpose
This packet defines the operational requirements for wiring the BHFOS Review Gate (`tools/review-gate.mjs`) into the GitHub Actions CI pipeline.

## Scope Lock
This packet is strictly limited to:
- Creating/updating a GitHub Actions workflow to run the gate on Pull Requests.
- Modifying `tools/review-gate.mjs` to accurately read PR diffs (Base vs. Head) in a CI environment.
- Enforcing the correct monorepo execution path.

## Critical Monorepo Execution Rules
BHFOS is a monorepo.
- The GitHub workflow file MUST reside in the repository root: `.github/workflows/`
- The `tools/review-gate.mjs` script MUST be executed from within the `command-center/` directory.
- If executed from the repo root, the gate will fail to find `STATUS_VOCABULARY_LOCK_V1.md` and trigger a Fail Closed state.

## CI Diff Resolution Rule
The current Review Gate relies on local working-tree diffs (`git diff`). In a CI environment, this results in an empty diff.
- The gate MUST be updated to detect a CI environment (e.g., `process.env.GITHUB_ACTIONS`).
- When in CI, the gate MUST calculate the diff using PR refs (Base vs. Head).
- The CI workflow MUST be configured to fetch sufficient git history (`fetch-depth: 0` or specifically fetching base/head) to allow this comparison.

## Acceptance Criteria
- PRs automatically trigger the gate.
- The gate correctly identifies changed files between the PR branch and the target branch.
- The gate fails the CI check if vocabulary drift is detected.
- The workflow logs output the exact failure reasons clearly.

