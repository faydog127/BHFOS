# I2 Provisioning Checklist — current campaign controls

> **BHFOS Operating Model v2.2.** Based on the G2.3B-B1/B2 template and extended
> for `NOS-I2-S1-EVIDENCE-01`. Closed G2.3 is not reopened. Do not provision or
> revoke anything until the current campaign gates pass.
>
> Content rules: names and categories only — **never** secret values, token
> fragments, passwords, or private keys.

---

## 1. Authorization gate (required before any B2 action)

| Field | Value |
| --- | --- |
| Authorization reference | B2A/B2C/B2C-App granted; B2C merge `9ba22c28…`; Supabase campaign governed by approved `NOS-R1-S1-I2-CAP-01`, execution gates pending |
| Risk tier | Tier 3 |
| Actor allowed to provision | Founder-authorized human credential provisioner under `NOS-R1-S1-I2-CAP-01`, after `FOUNDER_RUN_READY`; no agent reads secret values |
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
| Exact system | Production Supabase project ref `wwyxohjnyqnegzbxtuxs` (adapter lock) |
| Exact identity | Dedicated campaign OAuth application + Founder authorization under `NOS-R1-S1-I2-CAP-01` |
| Exact permissions | Dashboard **Projects Read + Database Read** only (wire scopes `projects:read` + `database:read`); adapter allowlist metadata/health/bounded catalog only |
| Token project scope | **Not proven** at token layer; project isolation is adapter-enforced |
| Issue time | _pending exact-head review, merge authorization, merge, and `FOUNDER_RUN_READY` under `NOS-R1-S1-I2-CAP-01`_ |
| Expiration | Short-lived access token; refresh until revoked (platform-controlled) |
| Credential-storage category | Diagnostics adapter secret env only |
| Inventory name rows | `I2_SUPABASE_OAUTH_CLIENT_ID`, `I2_SUPABASE_OAUTH_CLIENT_SECRET` (if issued), `I2_SUPABASE_OAUTH_ACCESS_TOKEN`, `I2_SUPABASE_OAUTH_REFRESH_TOKEN`, `I2_SUPABASE_OAUTH_TOKEN_EXPIRY`, `SUPABASE_DIAGNOSTICS_PROJECT_REF` |
| Actor | Founder-authorized human credential provisioner under `NOS-R1-S1-I2-CAP-01`; Production Diagnostics uses but does not provision or inspect values |
| Audit attribution | OAuth app identity (not founder-personal PAT) |
| Successful read test | _pending B3_ |
| Negative-capability test | Local adapter denial + static allowlist/route proof + permission metadata; **no production write request** — _pending campaign verification_ |
| Explicitly not provisioned | PAT; Dashboard Read-Only member; service-role; `SUPABASE_DIAGNOSTICS_ADAPTER_TOKEN`; agent-held OAuth; unrestricted Supabase MCP |

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
- [ ] Supabase campaign OAuth lifecycle credentials issued only after all `NOS-R1-S1-I2-CAP-01` gates pass (or deferral recorded)
- [x] **No** secret value in repository, PR, chat, or Markdown
- [x] Over-scope review: GitHub Administration none; Hostinger none; Supabase campaign ceiling Projects Read + Database Read only
- [x] Emergency-disable procedure acknowledged (`I2_REVOCATION_CHECKLIST.md`)
- [ ] B3 connection verification scheduled under separate authorization
- [ ] Campaign expiry recorded: 2026-09-30 23:59 America/New_York or evidence completion, whichever comes first
- [ ] Mandatory campaign revocation and read-endpoint denial check scheduled

---

## 4. Explicit non-action notes

B1 was planning-only. B2C merged App + launcher + adapter (no Supabase credential).
Live connection / negative-write remain **B3**. Hostinger Diagnostics remains blocked.
