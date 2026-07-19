# Environment Acceptance

Governance version: **v2.2** (Founder Focus additive)
Scope: **governance / control-plane only.**

Parent model: [`OPERATING_MODEL_v2.2.md`](./OPERATING_MODEL_v2.2.md).
Related: [`FOUNDER_RUN_READINESS.md`](./FOUNDER_RUN_READINESS.md).

## When ENVIRONMENT_ACCEPTANCE is required

Require ENVIRONMENT_ACCEPTANCE when work depends on any of:

- Windows behavior
- PowerShell
- browser launch
- OAuth redirects
- local listeners
- certificates
- filesystem paths
- worktree state
- deployment CLIs
- external platform behavior
- shell quoting or escaping
- operating-system-specific executable discovery

Unit tests alone are **not** sufficient for these classes. The acceptance test
must cover the **complete path** relevant to the Founder action. Mocks or
non-production fixtures are allowed when live authorization is not permitted,
but the test must exercise platform-specific integration.

## OAuth-style minimum path

For an OAuth-style Founder action, the minimum acceptance path is:

1. protected launcher
2. SHA verification
3. clean-worktree verification
4. secret-store discovery
5. secret-name presence check
6. browser executable validation
7. authorize URL construction
8. callback listener startup
9. callback URI contract
10. safe output
11. token-store destination

Record the acceptance run command and exit status in the FOUNDER_RUN_READINESS
packet (fields 15–16). Do not ask the Founder to execute until that path passes.

## Evidence rules

- Label claims SOURCE-ONLY / DEPLOYED / REACHABLE / USABLE as elsewhere.
- ENVIRONMENT_ACCEPTANCE proves platform-path readiness, **not** governance
  acceptance of residual risk and **not** production USABLE.
- Never display secret values in acceptance output.
