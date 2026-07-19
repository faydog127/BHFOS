# Exact Supabase OAuth App creation — G2.3B-B2D Option A (Founder UI)

> Binding ceiling from Founder **G2.3B-B2D Option A** authorization.
> **No secret values** belong in this file, chat, repository files, Cursor, or
> terminal command history.
>
> OAuth code exchange is performed by the **protected local helper only** — the
> Founder does **not** construct URLs, run PKCE, capture codes, or copy tokens.

**Authorized scope only:** Dashboard **Projects** → **Read** (wire `projects:read`).  
**Project ref (adapter lock):** `wwyxohjnyqnegzbxtuxs`  
**Redirect URI (exact):** `http://127.0.0.1:8765/oauth/callback`

---

## Quarantined tokens (binding)

Any OAuth access/refresh tokens issued during failed or non-clean attempts
(including pre-HTTP-harden / HTTPS-callback experiments) are **quarantined**:

- **Invalid for B3** and for any live Diagnostics campaign
- Must be **replaced** by a clean helper rerun after this HTTP + hardened launcher
  correction is on the Diagnostics worktree
- Do **not** reuse quarantined token values

---

## A. Create or update the OAuth application (Dashboard only)

1. Sign in as the **Founder** Supabase account that owns project `wwyxohjnyqnegzbxtuxs`.
2. Open that project’s **organization** → **Organization Settings → OAuth Apps**.
3. Create or edit **`BHFOS I2 Diagnostics`**.
4. Set:
   - **Redirect URI (exact):** `http://127.0.0.1:8765/oauth/callback`
   - **Scopes:** **Projects → Read** only (nothing else)
5. Confirm / save.

Do **not** register an HTTPS loopback redirect. Do **not** use `localhost` unless
you intentionally change both the app and the helper together (helper uses
`127.0.0.1` only).

---

## B. Place Client ID / secret in Diagnostics secret store only

1. Create or open the Diagnostics durable env file (gitignored; outside chat/repo).
2. Set `I2_DIAGNOSTICS_SECRET_ENV_FILE` to that file’s absolute path (Diagnostics shell only).
3. Put into that file (values never pasted into chat/Cursor/repo/history):
   - `I2_SUPABASE_OAUTH_CLIENT_ID`
   - `I2_SUPABASE_OAUTH_CLIENT_SECRET` (only if issued)
   - `SUPABASE_DIAGNOSTICS_PROJECT_REF=wwyxohjnyqnegzbxtuxs`

---

## C. Run the protected helper only (one command)

Use **only** the protected launcher from an updated Production Diagnostics worktree
(HTTP callback + approved Edge/Chrome absolute path launch). Do not use ad-hoc
scripts, browser address-bar OAuth, or quarantined tokens.

```bash
cd command-center
node tools/supabase-diagnostics-adapter/oauth-authorize.mjs
```

The helper will:

- bind **only** `127.0.0.1:8765` (plain HTTP)
- open Edge/Chrome via an approved absolute path (URL as one argv; no explorer/cmd/PATH)
- exchange the code with PKCE
- write access/refresh/expiry into the Diagnostics secret env file
- print **names/status only**

---

## D. Approve the browser consent screen

Approve as the Founder for the organization that owns `wwyxohjnyqnegzbxtuxs`.
Confirm status includes `OAuth authorization: completed` and
`token values: not displayed`.

---

## E. Explicit non-actions

Do **not**: grant other OAuth scopes; use HTTPS self-signed callbacks; paste
secrets into Cursor/chat/repo/history; reuse quarantined tokens; start B3; use
PAT / Dashboard Read-Only / service-role; provision Hostinger.
