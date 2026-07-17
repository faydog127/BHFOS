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
| Authorization reference | _pending — Founder B2 Decision Packet id_ |
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
| Exact identity | I2 fine-grained PAT or GitHub App (`prod-diagnostics` naming) |
| Exact permissions | Read-only scopes per `DIAGNOSTICS_ACCESS.md` §4.1 |
| Issue time | _pending B2_ |
| Expiration | _pending B2_ (prefer short TTL) |
| Credential-storage category | Secret store |
| Inventory name row | `I2_GITHUB_DIAGNOSTICS_TOKEN` (or App id name) — names only |
| Actor | _pending B2_ |
| Audit attribution | Distinct I2 identity visible in audit log |
| Successful read test | _pending B3_ |
| Negative mutation test | Write/settings denied — _pending B3_ |
| Evidence required before accept | Read OK + negative write fail-closed + audit identity |

### 2.2 Hostinger

| Field | Planned / recorded value |
| --- | --- |
| Exact system | Hostinger hosting for `app.bhfos.com` |
| Exact identity | I2 read token or read-only role |
| Exact permissions | Read history/status/logs/version/errors only |
| Issue time | _pending B2_ |
| Expiration | _pending B2_ |
| Credential-storage category | Secret store |
| Inventory name row | `I2_HOSTINGER_DIAGNOSTICS_TOKEN` |
| Actor | _pending B2_ |
| Audit attribution | Named I2 (`unknown` if platform cannot attribute) |
| Successful read test | _pending B3_ |
| Negative mutation test | Upload/deploy/delete denied — _pending B3_ |
| Stop if | Only shared-admin login works |

### 2.3 Supabase

| Field | Planned / recorded value |
| --- | --- |
| Exact system | Production Supabase project |
| Exact identity | I2 read-only member / management token |
| Exact permissions | Logs + metadata + inventory; **no** service-role |
| Issue time | _pending B2_ |
| Expiration | _pending B2_ |
| Credential-storage category | Secret store |
| Inventory name row | `I2_SUPABASE_DIAGNOSTICS_TOKEN` |
| Actor | _pending B2_ |
| Audit attribution | Named I2 project member |
| Successful read test | _pending B3_ |
| Negative mutation test | Write/DDL/deploy/`execute-sql` denied — _pending B3_ |
| Explicitly not provisioned | `SUPABASE_SERVICE_ROLE_KEY` for I2 |

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

- [ ] Founder B2 authorization reference recorded on Baton/Ledger (references only)
- [ ] Each issued secret **name** added to `SECRET_INVENTORY.md` as unverified→yes
- [ ] **No** secret value in repository, PR, chat, or Markdown
- [ ] Over-scope review: issued permissions ⊆ approved matrix
- [ ] Emergency-disable procedure acknowledged (`I2_REVOCATION_CHECKLIST.md`)
- [ ] B3 connection verification scheduled under separate authorization

---

## 4. Explicit non-action (B1)

This checklist was **not** executed. No identities were created. No tokens were
issued. No secret-store entries were created.
