# GitHub Diagnostics Launcher

Mints short-lived GitHub App **installation** tokens and starts official GitHub
MCP in read-only mode. App private key never enters the MCP container env as a
retained agent-visible secret beyond process spawn (stripped from child env).

## Required Diagnostics env (names only)

- `I2_GITHUB_APP_ID`
- `I2_GITHUB_APP_INSTALLATION_ID`
- `I2_GITHUB_APP_PRIVATE_KEY_PATH` (preferred) or `I2_GITHUB_APP_PRIVATE_KEY`

## Safety

- No secrets on argv
- No logging of tokens/keys
- `GITHUB_READ_ONLY=1` forced for MCP
- Restricted toolsets only
