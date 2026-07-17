# I2 Provisioning Checklist (G2.3B-B2 template)

> **BHFOS Operating Model v2.2 — G2.3B-B1.** Template for **future** B2 identity
> and credential provisioning. **Do not provision or revoke anything under B1.**
>
> Content rules: names and categories only — **never** secret values, token
> fragments, passwords, or private keys.

---

## 1. Authorization gate (required before any B2 action)

| Field | Value |
| --- | --- |
| Authorization reference | B2A/B2C/B2C-App granted; B2C merge `9ba22c28…`; **B2D pending** for Supabase adapter credential |
| Risk tier | Tier 3 |
| Actor allowed to provision | Founder or delegated operator **under exact B2 auth** |
| B1 prerequisite | G2.3B-B1 merged; `DIAGNOSTICS_ACCESS.md` accepted |
| Live provisioning in B1 | **Not authorized / not performed** |

If authorization is missing → **stop**.

---

## 2. Per-system provisioning rows

Complete one row per identity. Leave values out of the repository; store values
only in the approved secret-store category.

### 2.1 GitHub

| Field | Planned / recorded value |
| --- | --- |
| Exact system | GitHub `faydog127/BHFOS` |
| Exact identity | Dedicated App `BHFOS I2 Diagnostics` (installation tokens via protected launcher) |
| Exact permissions | Metadata/Contents/Actions/PRs/Commit statuses **read**; Administration **none** |
| Issue time | Founder-attested under B2C-App (pre-merge #54) |
| Expiration | Short-lived installation tokens (launcher-minted) |
| Credential-storage category | Diagnostics secret store only |
| Inventory name row | `I2_GITHUB_APP_ID` / `I2_GITHUB_APP_INSTALLATION_ID` / `I2_GITHUB_APP_PRIVATE_KEY` |
| Actor | Founder (provision); Production Diagnostics launcher (mint) |
| Audit attribution | GitHub App installation identity |
| Successful read test | _pending B3_ (App+launcher ≠ live proof) |
| Negative mutation test | Write/settings denied — _pending B3_ |
| Evidence required before accept | Read OK + negative write fail-closed + audit identity (**B3**) |

### 2.2 Hostinger

| Field | Planned / recorded value |
| --- | --- |
| Exact system | Hostinger hosting for `app.bhfos.com` |
| Exact identity | **None** — `READ_ONLY_CAPABILITY_UNAVAILABLE` for Diagnostics |
| Exact permissions | N/A |
| Issue time | **Do not issue in G2.3B** |
| Expiration | N/A |
| Credential-storage category | N/A |
| Inventory name row | `I2_HOSTINGER_DIAGNOSTICS_TOKEN` — blocked |
| Actor | N/A |
| Audit attribution | N/A |
| Successful read test | N/A (Diagnostics) |
| Negative mutation test | N/A (Diagnostics) |
| Stop if | Only shared-admin login works — **recorded; reserved for G2.3C Operator** |

### 2.3 Supabase

| Field | Planned / recorded value |
| --- | --- |
| Exact system | Production Supabase project |
| Exact identity | Adapter-internal OAuth2 Management API token (pending B2D) |
| Exact permissions | Per B2D Option A or B; **no** service-role; adapter deny `/body`/SQL/secrets |
| Issue time | _pending G2.3B-B2D_ |
| Expiration | _pending B2D_ |
| Credential-storage category | Diagnostics secret store → adapter env only |
| Inventory name row | `SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN` |
| Actor | Founder under B2D only |
| Audit attribution | OAuth app / adapter identity |
| Successful read test | _pending B3_ |
| Negative mutation test | Write/DDL/deploy/`execute-sql`/`/body` denied — _pending B3_ |
| Explicitly not provisioned | `SUPABASE_SERVICE_ROLE_KEY` for I2; agent-held OAuth; unrestricted Supabase MCP |

### 2.4 Application build identity / health

| Field | Planned / recorded value |
| --- | --- |
| Exact system | Production HTTPS (`app.bhfos.com`) |
| Exact identity | None (anonymous GET) |
| Exact permissions | GET build-info; non-destructive health |
| Credential-storage category | N/A |
| Negative mutation test | No POST/PUT/PATCH/DELETE in probe — _pending B3_ |

### 2.5 Browser diagnostics

| Field | Planned / recorded value |
| --- | --- |
| Exact system | Browser DevTools against production |
| Exact identity | Non-impersonating session |
| Exact permissions | Console/network observation only |
| Credential-storage category | N/A (no cookie export) |
| Negative mutation test | No token/cookie in artifacts — _pending B3_ |

---

## 3. Post-provisioning checklist (B2 complete when all true)

- [x] Founder B2 authorization references recorded on Baton/Ledger (B2A/B2C/B2C-App; B2C merge `9ba22c28…`)
- [x] GitHub App secret **names** in `SECRET_INVENTORY.md` (`founder_attested_present`)
- [x] Hostinger recorded `READ_ONLY_CAPABILITY_UNAVAILABLE` (no Diagnostics credential)
- [ ] Supabase adapter credential issued under **G2.3B-B2D** (or Option C deferral recorded)
- [x] **No** secret value in repository, PR, chat, or Markdown
- [x] Over-scope review: GitHub Administration none; Hostinger none; Supabase none until B2D
- [x] Emergency-disable procedure acknowledged (`I2_REVOCATION_CHECKLIST.md`)
- [ ] B3 connection verification scheduled under separate authorization

---

## 4. Explicit non-action notes

B1 was planning-only. B2C merged App + launcher + adapter (no Supabase credential).
Live connection / negative-write remain **B3**. Hostinger Diagnostics remains blocked.
