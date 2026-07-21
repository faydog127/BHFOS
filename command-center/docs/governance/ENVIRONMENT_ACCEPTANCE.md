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
- HTTPS tunnel / Named Tunnel lifecycle

Unit tests alone are **not** sufficient for these classes. The acceptance test
must cover the **complete path** relevant to the Founder action. Mocks or
non-production fixtures are allowed when live authorization is not permitted,
but the test must exercise platform-specific integration.

## OAuth-style minimum path (G2.3B-B2D Option B HTTPS tunnel)

For an OAuth-style Founder action under the Cloudflare Named Tunnel design, the
minimum acceptance path is:

1. protected launcher
2. exact SHA verification
3. clean worktree verification
4. external secret store (`I2_DIAGNOSTICS_SECRET_ENV_FILE` outside repo)
5. browser (approved absolute Edge/Chrome path)
6. public HTTPS redirect URI (`https://oauth-diagnostics.bhfos.com/oauth/callback`)
7. named tunnel (Cloudflare Named Tunnel; stable FQDN only)
8. path-only routing (`/oauth/callback` only + catch-all deny + Host rewrite)
9. local callback (`http://127.0.0.1:8765/oauth/callback`)
10. state validation (single-use)
11. PKCE validation (S256)
12. local code exchange
13. external token-store write (Diagnostics env file only; values not displayed)
14. tunnel shutdown after every authorize attempt
15. public callback closure verification
16. post-run governance status (safe status lines only)

Supporting checks on the same path: secret-name presence (values not displayed),
tunnel executable/config/credential presence outside the repository, local port
availability, and `FOUNDER_RUN_READY` gate before tunnel start.

Record the acceptance run command and exit status in the FOUNDER_RUN_READINESS
packet (fields 15–16). Do not ask the Founder to execute until that path passes.

### Acceptance commands (Diagnostics worktree)

```bash
cd command-center
npm run test:supabase-oauth-helper
npm run test:supabase-oauth-tunnel
npm run test:supabase-oauth-launcher-preflight
npm run test:founder-run-readiness
```

Live Cloudflare is not required for CI or unit acceptance. Live tunnel health
and closure probes run only under a `FOUNDER_RUN_READY` Founder authorize session.

## Evidence rules

- Label claims SOURCE-ONLY / DEPLOYED / REACHABLE / USABLE as elsewhere.
- ENVIRONMENT_ACCEPTANCE proves platform-path readiness, **not** governance
  acceptance of residual risk and **not** production USABLE.
- Never display secret values in acceptance output.
- Tunnel credentials must never enter the repository.
