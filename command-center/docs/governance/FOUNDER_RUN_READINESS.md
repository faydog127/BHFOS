# Founder Run Readiness Gate

Governance version: **v2.2** (Founder Focus additive)
Scope: **governance / control-plane only.** No application runtime change.

Parent model: [`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md).

## Purpose

Prevent the Founder from becoming the integration tester. Before any agent asks
the Founder to perform an environment-specific manual action, the Orchestrator
(or assigned coordinating owner) must produce a machine-assisted readiness
report that ends with exactly one of:

```
FOUNDER_RUN_READY
```

or

```
FOUNDER_RUN_BLOCKED
```

If any required field fails, the Founder must **not** receive the execution
command.

## When the gate is mandatory

Run FOUNDER_RUN_READINESS before asking the Founder to:

- run a terminal command
- approve an OAuth consent screen
- enter or rotate credentials
- use a platform dashboard
- execute a protected launcher
- interact with production infrastructure
- perform any environment-specific manual action

## Required readiness fields

| # | Field | Machine-checkable |
| --- | --- | --- |
| 1 | Task and authorization boundary | Declarative (must be non-empty; Orchestrator attests) |
| 2 | Exact repository | Yes (`git remote get-url origin`) |
| 3 | Exact worktree path | Yes (path exists; matches assignment) |
| 4 | Exact commit SHA | Yes (`git rev-parse HEAD`) |
| 5 | Worktree cleanliness | Yes (`git status --porcelain` empty) |
| 6 | Protected launcher or script path | Yes (path exists) |
| 7 | Launcher SHA pin matches worktree SHA | Yes (when a pin file/arg is provided) |
| 8 | Required files exist | Yes |
| 9 | External secret-store path exists | Yes (path outside repo when required) |
| 10 | Required secret names are present; values not displayed | Yes (name presence only) |
| 11 | No credential file exists inside the repository | Yes (deny-list scan) |
| 12 | Required callback / endpoint / redirect configuration matches exactly | Yes (when applicable) |
| 13 | Required local port is available | Yes (when applicable) |
| 14 | Required browser / runtime / CLI / platform dependency is detected | Yes (when applicable) |
| 15 | Platform-specific acceptance tests passed | Yes (recorded command exit 0) |
| 16 | Required unit and integration tests passed | Yes (recorded command exit 0) |
| 17 | Architecture Guard approval applies to the exact execution design | Declarative + SHA match |
| 18 | Expected safe output | Declarative (must be non-empty) |
| 19 | Explicit stop conditions | Declarative (must be non-empty) |
| 20 | One exact Founder command or action | Declarative (exactly one) |

## Machine tool

```bash
npm run test:founder-run-readiness
# or, for a live readiness packet:
node tools/founder-run-readiness.mjs --packet <path-to-packet.json>
```

Packet schema: [`templates/FOUNDER_RUN_READINESS.template.json`](./templates/FOUNDER_RUN_READINESS.template.json).

## Failure routing

When the gate returns `FOUNDER_RUN_BLOCKED`:

1. Do **not** send the Founder the execution command.
2. The Orchestrator classifies the failure (worktree, pin, secrets path, tests,
   AG coverage, environment acceptance, etc.).
3. Route correction to Builder / Architecture Guard / Diagnostics as appropriate.
4. Do **not** ask the Founder to diagnose shell errors, file extensions, SHA pins,
   or configuration mismatches.

## Report contract

Every readiness report must include:

- TECHNICAL RESULT (what the checks observed)
- GOVERNANCE STATUS (whether Founder execution is authorized)
- AUTHORIZED NEXT STATE (ready command **or** routed correction)

And must end with exactly `FOUNDER_RUN_READY` or `FOUNDER_RUN_BLOCKED`.
