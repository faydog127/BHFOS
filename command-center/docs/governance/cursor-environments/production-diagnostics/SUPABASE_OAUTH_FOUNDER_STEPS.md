# Exact Supabase OAuth App creation — G2.3B-B2D Option A (Founder UI)

> Binding ceiling from Founder **G2.3B-B2D Option A** authorization.
> **No secret values** belong in this file, chat, or repository.
>
> OAuth code exchange is performed by the **protected local helper** — the Founder
> does **not** construct URLs, run PKCE, capture codes, or copy tokens.

**Authorized scope only:** Dashboard **Projects** → **Read** (wire `projects:read`).  
**Project ref (adapter lock):** `wwyxohjnyqnegzbxtuxs`

---

## A. Create the OAuth application (Dashboard only)

1. Sign in as the **Founder** Supabase account that owns project `wwyxohjnyqnegzbxtuxs`.
2. Open that project’s **organization** → **Organization Settings → OAuth Apps**.
3. Click **Add application**.
4. Set:
   - **Name:** `BHFOS I2 Diagnostics`
   - **Website** (if asked): `https://github.com/faydog127/BHFOS`
   - **Redirect URI:** `http://127.0.0.1:8765/oauth/callback`
   - **Scopes:** **Projects → Read** only (nothing else)
5. Confirm / create.

---

## B. Place Client ID / secret in Diagnostics secret store only

1. Create or open the Diagnostics durable env file (gitignored; outside chat/repo).
2. Set environment variable `I2_DIAGNOSTICS_SECRET_ENV_FILE` to that file’s absolute path
   (Diagnostics shell / profile only).
3. Put into that file / Diagnostics env (values never pasted into chat):
   - `I2_SUPABASE_OAUTH_CLIENT_ID`
   - `I2_SUPABASE_OAUTH_CLIENT_SECRET` (only if the Dashboard issued one)
   - `SUPABASE_DIAGNOSTICS_PROJECT_REF=wwyxohjnyqnegzbxtuxs`
4. Optional (only if needed for consent pre-select): `I2_SUPABASE_OAUTH_ORGANIZATION_SLUG`

---

## C. Run the protected helper (one command)

> **Windows note:** Use a helper build that includes the Windows browser-launch
> fix (PowerShell `Start-Process -FilePath` with a single-quoted URL). Older
> builds that used `cmd /c start` truncate the authorize URL at the first `&`
> and never reach consent. Do not retry until that fix is on the Diagnostics
> worktree / main.

From a Production Diagnostics shell with the secret env loaded:

```bash
cd command-center
node tools/supabase-diagnostics-adapter/oauth-authorize.mjs
```

The helper will:

- bind `127.0.0.1:8765`
- open the browser consent screen (**without** printing the authorize URL)
- exchange the code
- write `I2_SUPABASE_OAUTH_ACCESS_TOKEN`, `I2_SUPABASE_OAUTH_REFRESH_TOKEN`, and
  `I2_SUPABASE_OAUTH_TOKEN_EXPIRY` into the Diagnostics secret env file
- print **names/status only** (never token values)

---

## D. Approve the browser consent screen

When the browser opens, approve as the Founder for the organization that owns
`wwyxohjnyqnegzbxtuxs`. Then confirm the helper printed status lines including
`OAuth authorization: completed` and `token values: not displayed`.

---

## E. Explicit non-actions

Do **not**: grant any other OAuth scope; manually craft authorize URLs; copy codes
or tokens; use PAT / Dashboard Read-Only / service-role; paste secrets into chat;
run B3 under this packet; provision Hostinger.
