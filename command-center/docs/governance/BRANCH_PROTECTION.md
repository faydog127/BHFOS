# Branch Protection — Ledger Lock Enforcement

This repo’s “lock” claims only hold if the CI lanes are non-optional.

## Target branch

- `main`

## Required status checks

Require these checks to pass before merge:

- `CI / lint`
- `CI / build`
- `Ledger Lock / ledger_lock`

Note: GitHub shows required checks using the `Workflow Name / Job Name` format. If these labels differ in your UI, select the equivalent check runs for:

- workflow `CI` jobs `lint` and `build`
- workflow `Ledger Lock` job `ledger_lock`

## Recommended CODEOWNERS

Add CODEOWNERS so governance/lock changes always require a deliberate review:

- `.github/CODEOWNERS`

## Required merge policy

Recommended settings:

- Require a pull request before merging
- Require status checks to pass before merging (above)
- Dismiss stale approvals when new commits are pushed (recommended)
- Require conversation resolution (recommended)

Optional (stricter):

- Require linear history
- Require signed commits

## Why this exists

- The ledger lock is a maintained standard, not a one-off green run.
- Without branch protection, a single “unchecked” merge can silently invalidate the baseline.
