# Branch Protection — Ledger Lock Enforcement

This repo's "lock" claims only hold if the CI lanes are non-optional.

## Target branch

- `main`

## Required status checks

Require these checks to pass before merge:

- `CI / lint`
- `CI / identity_contracts`
- `CI / build`
- `Ledger Lock / ledger_lock`

Note: GitHub shows required checks using the `Workflow Name / Job Name` format. If these labels differ in your UI, select the equivalent check runs for:

- workflow `CI` jobs `lint`, `identity_contracts`, and `build`
- workflow `Ledger Lock` job `ledger_lock`

> **G2.3A update.** `CI / identity_contracts` is now listed as a required check.
> The `CI` workflow defines an `identity_contracts` job (`guard:identity` +
> `test:identity-helpers`); previously this document omitted it, which left an
> identity-contract regression able to merge without a required gate. It is
> included here so repository expectations match the workflow definition.

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

## Read-only verification procedure

Branch-protection state is verified with `command-center/tools/verify-branch-protection.mjs`.
The verifier **never changes any GitHub setting**. It distinguishes three tiers
of knowledge:

1. **Repository-derivable (no API):** the expected required checks derived from
   the `.github/workflows/` files, the presence of `.github/CODEOWNERS`, and the
   intended policy documented above.
2. **GitHub-API-derivable (only with `--remote` and an authenticated `gh`):** the
   actual enforcement of required status checks, required reviews, and
   force-push / deletion restrictions on `main`.
3. **Deferred to a later phase (G2.3B read-only diagnostics):** org-level
   overrides, actor bypass lists, and anything requiring elevated GitHub scopes.

Commands:

```bash
# Repository expectations only (no network):
node tools/verify-branch-protection.mjs --branch=main

# Include live GitHub state (read-only; requires authenticated gh):
node tools/verify-branch-protection.mjs --branch=main --remote --json
```

When API access is unavailable the verifier reports exactly what it could and
could not confirm and does not guess. As of G2.3A, live GitHub enforcement has
**not** been asserted here; it is verified or attested in the read-only
diagnostics phase (G2.3B). This document records the *intended* required checks.

## Why this exists

- The ledger lock is a maintained standard, not a one-off green run.
- Without branch protection, a single "unchecked" merge can silently invalidate the baseline.
