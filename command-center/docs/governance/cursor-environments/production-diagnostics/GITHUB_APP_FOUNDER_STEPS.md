# Exact GitHub App creation fields — G2.3B-B2C-App (Founder UI)

> Binding ceiling from Founder authorization. **No secret values** belong in
> this file, chat, or repository. After create/install, store App ID,
> installation ID, and private key **only** in the Production Diagnostics
> secret environment.

## A. Create the App

1. Sign in to GitHub as the founder account that owns `faydog127/BHFOS`.
2. Open: https://github.com/settings/apps/new  
   (or **Settings → Developer settings → GitHub Apps → New GitHub App**)

### Required fields

| Field | Exact value / choice |
| --- | --- |
| **GitHub App name** | `BHFOS I2 Diagnostics` (or unique variant if taken, e.g. `BHFOS I2 Diagnostics 2026`) |
| **Homepage URL** | `https://github.com/faydog127/BHFOS` |
| **Callback URL** | Leave blank / unused (no user-to-user OAuth) |
| **Setup URL** | Optional; leave blank |
| **Webhook** | **Uncheck** “Active” (no webhook required for Diagnostics MCP) |
| **Webhook URL / secret** | Leave blank (webhook inactive) |
| **Permissions → Repository permissions** | See section B only |
| **Permissions → Organization permissions** | **No access** (all) |
| **Permissions → Account permissions** | **No access** (all) — do **not** enable user authorization to act as the founder |
| **Subscribe to events** | None required (leave unchecked) |
| **Where can this GitHub App be installed?** | **Only on this account** |

3. Click **Create GitHub App**.

### Immediately after create (still on App settings)

4. **Generate a private key** (App settings → Private keys → Generate).  
   Download the `.pem` once. Store it **only** in the Production Diagnostics secret environment (file path or secret slot).  
   **Do not** paste the key into chat, Markdown, repo, or global MCP config.
5. Note the **App ID** (numeric, shown on the App’s settings page). Store as inventory name `I2_GITHUB_APP_ID` in Diagnostics secrets only.

---

## B. Repository permissions (exact)

Set **only** these — all others **No access**:

| Permission | Access |
| --- | --- |
| **Metadata** | **Read-only** |
| **Contents** | **Read-only** |
| **Actions** | **Read-only** |
| **Pull requests** | **Read-only** |
| **Commit statuses** | **Read-only** |

**Do not grant:**

- **Administration** (any access) — deferred; ruleset evidence first via ordinary reads; separate Decision Packet if classic branch-protection still needs it  
- Contents/Actions/PRs/Metadata **read and write**  
- Workflows, Secrets, Variables, Deployments, Issues, Environments, etc.  
- Any Organization or Account permissions  

Save permission changes if GitHub prompts to save.

---

## C. Install the App (single repository)

1. On the App’s page, open **Install App** (or **Install App** from the left sidebar).
2. Choose the **founder account** (`faydog127`).
3. Select **Only select repositories** — **not** “All repositories”.
4. Select repository: **`BHFOS`** (`faydog127/BHFOS`) only.
5. Click **Install**.

### After install

6. Note the **installation ID**:  
   From the install URL  
   `https://github.com/settings/installations/<INSTALLATION_ID>`  
   or App → Installations → the `faydog127` install.  
   Store as `I2_GITHUB_APP_INSTALLATION_ID` in Diagnostics secrets only.

---

## D. Diagnostics secret environment (names only)

Store **only**:

| Inventory name | What |
| --- | --- |
| `I2_GITHUB_APP_ID` | Numeric App ID |
| `I2_GITHUB_APP_INSTALLATION_ID` | Numeric installation ID |
| `I2_GITHUB_APP_PRIVATE_KEY` / path | Private key material or secure file path for the launcher |

Confirm these are **unavailable** to Production Operator, Release Agent, Independent UAT, and global Cursor MCP.

---

## E. Confirm back to Orchestrator (no secrets)

Reply with **status only**, for example:

- App name created: `…`
- Installed on: `faydog127/BHFOS` only (Only select repositories)
- Permissions: Metadata/Contents/Actions/Pull requests/Commit statuses = read; Administration = none
- User/account permissions: none
- Webhook: inactive
- Diagnostics secret env: App ID, installation ID, private key **present** (do not paste values)
- Issue #55: not promoted; no collaborator/PAT/visibility change

---

## Explicit non-actions under this authorization

Do **not**: create a machine user; invite collaborators; issue a PAT; transfer the repo; change visibility; promote issue #55; merge PR #54; grant Administration; enable founder user-to-user authorization.
