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
| 11 | No credential file exists inside the repository | Yes (secret-store / key / populated-assignment scan; not doc/UI name keywords) |
| 12 | Required callback / endpoint / redirect configuration matches exactly | Yes (when applicable) |
| 13 | Required local port is available | Yes (when applicable) |
| 14 | Required browser / runtime / CLI / platform dependency is detected | Yes (when applicable) |
| 15 | Platform-specific acceptance tests passed | Yes (recorded command exit 0) |
| 16 | Required unit and integration tests passed | Yes (recorded command exit 0) |
| 17 | Architecture Guard approval applies to the exact execution design | Declarative + SHA match |
| 18 | Expected safe output | Declarative (must be non-empty) |
| 19 | Explicit stop conditions | Declarative (must be non-empty) |
| 20 | One exact Founder command or action | Declarative (exactly one) |
| 21 | Tunnel required + class is Cloudflare Named Tunnel (when OAuth tunnel packet) | Yes (when `tunnel.required`) |
| 22 | Stable public hostname / FQDN pinned exactly | Yes (when `tunnel.required`) |
| 23 | Public HTTPS redirect URI matches helper contract exactly | Yes (when `tunnel.required`) |
| 24 | Tunnel credentials path exists outside the repository | Yes (when `tunnel.required`) |
| 25 | Path-only forward contract attested | Yes (when `tunnel.required`) |
| 26 | Catch-all deny attested | Yes (when `tunnel.required`) |
| 27 | Tunnel stop-after-run + public callback closure procedure present | Yes (when `tunnel.required`) |
| 28 | Tunnel executable present (absolute path) | Yes (when `tunnel.required`) |
| 29 | Tunnel configuration present outside repo | Yes (when `tunnel.required`) |
| 30 | Tunnel start / stop / closure verification commands present | Yes (when `tunnel.required`) |
| 31 | Local listener remains loopback-only (`127.0.0.1`) | Yes (when `tunnel.required`) |
| 32 | No random or quick-tunnel hostname | Yes (when `tunnel.required`) |

### OAuth tunnel packet contract (G2.3B-B2D Option B)

When authorizing Diagnostics Supabase OAuth under Option B, set:

```json
"callback_or_redirect_expected": "https://oauth-diagnostics.bhfos.com/oauth/callback",
"callback_or_redirect_actual": "https://oauth-diagnostics.bhfos.com/oauth/callback",
"required_local_port": 8765,
"tunnel": {
  "required": true,
  "class": "cloudflare_named",
  "stable_hostname": "oauth-diagnostics.bhfos.com",
  "public_redirect_uri": "https://oauth-diagnostics.bhfos.com/oauth/callback",
  "local_listener_uri": "http://127.0.0.1:8765/oauth/callback",
  "credentials_path": "%LOCALAPPDATA%/BHFOS/production-diagnostics/tunnel/<credentials>.json",
  "executable_path": "C:/Program Files/cloudflared/cloudflared.exe",
  "config_path": "%LOCALAPPDATA%/BHFOS/production-diagnostics/tunnel/oauth-tunnel-config.yml",
  "path_only_config_attested": true,
  "catch_all_deny_attested": true,
  "start_command": "cloudflared tunnel --config <outside-repo-config> run",
  "stop_command": "helper stop() / SIGTERM cloudflared",
  "closure_verification_command": "GET public callback must fail closed after stop",
  "stop_after_run_and_closure_procedure_present": true
}
```

Architecture Guard approval (`architecture_guard_approval`) must apply to the
**exact execution design head SHA** (field 17). No in-repo tunnel credentials.

Do **not** ask the Founder to run OAuth until the packet evaluates to exactly
`FOUNDER_RUN_READY`. Tunnel credentials never enter the repository.

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
