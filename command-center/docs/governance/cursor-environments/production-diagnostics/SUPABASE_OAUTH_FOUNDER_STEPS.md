# Exact Supabase OAuth App creation — Network OS Slice 1 I2 campaign (Founder UI)

> Binding ceiling from Founder decision **NOS-R1-S1-I2-CAP-01** for control-plane
> release `NOS-I2-S1-EVIDENCE-01` (Cloudflare Named Tunnel → loopback helper).
> This campaign does not reopen closed G2.3.
> **No secret values** belong in this file, chat, repository files, Cursor, or
> terminal command history.
>
> OAuth code exchange is performed by the **protected local helper only** — the
> Founder does **not** construct URLs, run PKCE, capture codes, or copy tokens.

**Authorized scopes only:** Dashboard **Projects** → **Read** and **Database** →
**Read** (wire `projects:read` + `database:read`). No other scope.
**Project ref (adapter lock):** `wwyxohjnyqnegzbxtuxs`  
**Public redirect URI (exact):** `https://oauth-diagnostics.bhfos.com/oauth/callback`  
**Local listener (helper bind only):** `http://127.0.0.1:8765/oauth/callback`  
**Tunnel class:** Cloudflare Named Tunnel (stable hostname only; no random/temporary hostnames)

---

## Quarantined tokens (binding)

Any OAuth access/refresh tokens issued during failed or non-clean attempts
(including HTTP-loopback rejection, PR #58 self-signed HTTPS experiments, and
pre-tunnel runs) are **quarantined**:

- **Invalid for B3** and for any live Diagnostics campaign
- Must be **replaced** by a clean helper rerun after this Option B tunnel design
  is merged and `FOUNDER_RUN_READY` is issued
- Do **not** reuse quarantined token values

PR #58 (self-signed `https://127.0.0.1` callback) is **superseded** and must not
be merged as the tunnel baseline.

---

## A. Create or update the OAuth application (Dashboard only)

1. Sign in as the **Founder** Supabase account that owns project `wwyxohjnyqnegzbxtuxs`.
2. Open that project’s **organization** → **Organization Settings → OAuth Apps**.
3. Create or edit **`BHFOS I2 Diagnostics`**.
4. Set:
   - **Redirect URI (exact):** `https://oauth-diagnostics.bhfos.com/oauth/callback`
   - **Scopes:** **Projects → Read** and **Database → Read** only (nothing else)
5. Confirm / save.

Do **not** register HTTP loopback, self-signed HTTPS loopback, `localhost`, or
any random/temporary tunnel hostname.

---

## B. Place Client ID / secret in Diagnostics secret store only

1. Create or open the Diagnostics durable env file (gitignored; outside chat/repo):
   `%LOCALAPPDATA%\BHFOS\production-diagnostics\diagnostics.env`
2. Set `I2_DIAGNOSTICS_SECRET_ENV_FILE` to that file’s absolute path (Diagnostics shell only).
3. Put into that file (values never pasted into chat/Cursor/repo/history):
   - `I2_SUPABASE_OAUTH_CLIENT_ID`
   - `I2_SUPABASE_OAUTH_CLIENT_SECRET` (only if issued)
   - `SUPABASE_DIAGNOSTICS_PROJECT_REF=wwyxohjnyqnegzbxtuxs`

---

## C. Place Named Tunnel credentials outside the repository

1. Create the Founder-owned Cloudflare Named Tunnel for hostname
   `oauth-diagnostics.bhfos.com` (Founder DNS / Cloudflare account).
2. Store tunnel credentials **outside the repo**, e.g.
   `%LOCALAPPDATA%\BHFOS\production-diagnostics\tunnel\<credentials>.json`
3. In the Diagnostics shell only, set:
   - `I2_CLOUDFLARE_TUNNEL_CREDENTIALS_FILE` → absolute path to that file
   - `I2_CLOUDFLARE_TUNNEL_ID` → named tunnel id
   - `I2_CLOUDFLARED_EXECUTABLE` → absolute path to `cloudflared` (optional if
     installed at an approved default absolute path)

Tunnel credentials must never be committed, pasted into chat, or stored under
the repository tree.

Ingress must forward **only** `/oauth/callback` to
`http://127.0.0.1:8765`, rewrite Host to `127.0.0.1:8765`, and catch-all deny
all other paths.

---

## D. Run only after FOUNDER_RUN_READY (one protected command)

Orchestrator must produce `FOUNDER_RUN_READY` first. Then, from an updated
Production Diagnostics worktree at the approved merge SHA:

```bash
cd command-center
set I2_FOUNDER_RUN_READINESS_VERDICT=FOUNDER_RUN_READY
set I2_OAUTH_EXPECTED_SHA=<exact approved merge SHA>
node tools/supabase-diagnostics-adapter/oauth-authorize.mjs
```

The helper will:

- verify exact SHA + clean worktree + external secret store + tunnel assets + port
- start the Named Tunnel
- bind **only** `127.0.0.1:8765` (plain HTTP local listener)
- open Edge/Chrome via an approved absolute path (URL as one argv; no explorer/cmd/PATH)
- exchange the code with PKCE locally
- write access/refresh/expiry into the Diagnostics secret env file
- stop the tunnel and verify public callback closure
- print **names/status only**

---

## E. Approve the browser consent screen

Approve as the Founder for the organization that owns `wwyxohjnyqnegzbxtuxs`.
Confirm status includes `OAuth authorization: completed`,
`token values: not displayed`, `tunnel stopped: yes`, and
`public callback closed: yes`.

---

## F. Explicit non-actions

Do **not**: perform these steps before the exact Stage A PR/SHA is independently
reviewed, separately merge-authorized, merged, and `FOUNDER_RUN_READY`; grant
other OAuth scopes; use HTTPS self-signed callbacks; reuse or
merge PR #58; paste secrets/tunnel credentials into Cursor/chat/repo/history;
reuse quarantined tokens; start B3; use PAT / Dashboard Read-Only / service-role;
provision Hostinger; leave the tunnel running after the authorize attempt.

## G. Campaign closure

This credential is campaign-scoped, not standing access. Revoke the OAuth
authorization and clear campaign token material from the external Diagnostics
environment after the approved Slice 1 evidence collection or by 2026-09-30
23:59 America/New_York, whichever occurs first. Verify revocation only by retrying
an approved read endpoint and expecting authentication denial. Never send a
production write request as a negative test.
