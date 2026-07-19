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
2. SHA verification
3. clean-worktree verification
4. secret-store discovery (`I2_DIAGNOSTICS_SECRET_ENV_FILE` outside repo)
5. secret-name presence check (values not displayed)
6. browser executable validation (approved absolute paths)
7. authorize URL construction with public HTTPS redirect
   (`https://oauth-diagnostics.bhfos.com/oauth/callback`)
8. callback listener startup (`http://127.0.0.1:8765/oauth/callback`)
9. callback URI contract (public HTTPS redirect split from local HTTP listener)
10. tunnel executable present (approved absolute path / pinned)
11. tunnel credentials path outside repository (presence only)
12. named tunnel id configured (`I2_CLOUDFLARE_TUNNEL_ID`)
13. path-only forward contract (`/oauth/callback` only + catch-all deny)
14. Host rewrite to `127.0.0.1:8765` attested
15. tunnel start gated on `FOUNDER_RUN_READY`
16. tunnel health / public callback path probe (no query strings logged)
17. tunnel stop after every authorize attempt (success or failure)
18. public callback closure verification after stop
19. safe output (no codes / state / PKCE / secrets / tokens)
20. token-store destination (approved external Diagnostics env file only)

Record the acceptance run command and exit status in the FOUNDER_RUN_READINESS
packet (fields 15–16). Do not ask the Founder to execute until that path passes.

### Acceptance commands (Diagnostics worktree)

```bash
cd command-center
npm run test:supabase-oauth-helper
npm run test:supabase-oauth-tunnel
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
