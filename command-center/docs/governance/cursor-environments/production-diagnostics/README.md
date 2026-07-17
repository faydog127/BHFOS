# Production Diagnostics — GitHub App + protected launcher (G2.3B-B2C-App)

> Names and wiring only. Never commit App private keys or installation tokens.

## Model

1. Private GitHub App (founder-owned interim) installed **only** on `faydog127/BHFOS`.
2. Diagnostics secret store holds: App ID, Installation ID, Private key.
3. Protected launcher (Diagnostics environment only) mints a **short-lived
   installation access token** and starts GitHub MCP with:
   - `GITHUB_PERSONAL_ACCESS_TOKEN=<installation token>`
   - `GITHUB_READ_ONLY=1`
   - `GITHUB_TOOLSETS=context,repos,pull_requests,actions`
4. Agent never receives the App private key.
5. Revoke by uninstalling/disabling the App and deleting secret-store entries.

## MCP template

See `mcp.json.template` — invoke via launcher wrapper (not raw Docker with a
long-lived PAT). Placeholder env names only.

## Not used

- Machine GitHub user
- Collaborator invite
- Fine-grained PAT
- Global Cursor MCP with App credentials
