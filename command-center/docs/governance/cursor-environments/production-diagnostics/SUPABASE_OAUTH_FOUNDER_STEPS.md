# Exact Supabase OAuth App creation — G2.3B-B2D Option A (Founder UI)

> Binding ceiling from Founder **G2.3B-B2D Option A** authorization.
> **No secret values** belong in this file, chat, or repository.
> Store credential values **only** in the Production Diagnostics adapter secret
> environment under the inventory names below.

**Authorized scope only:** Dashboard **Projects** → **Read** (wire `projects:read`).  
**Project ref (adapter lock):** `wwyxohjnyqnegzbxtuxs`  
**Residual risk:** Token-level single-project isolation is **not** proven; adapter enforces the ref lock.

---

## A. Create the OAuth application

1. Sign in to the **Founder** Supabase account (the account that owns production project `wwyxohjnyqnegzbxtuxs`).
2. Open the **organization** that owns that production project.
3. Go to **Organization Settings → OAuth Apps**.
4. Click **Add application**.

### Required fields (exact)

| Field | Exact value / choice |
| --- | --- |
| **Name** | `BHFOS I2 Diagnostics` |
| **Website / Homepage** (if prompted) | `https://github.com/faydog127/BHFOS` |
| **Redirect URI** | `http://127.0.0.1:8765/oauth/callback` |
| **Scopes** | Enable **only** **Projects** → **Read** |

### Scopes — select only this

| Dashboard category | Type |
| --- | --- |
| **Projects** | **Read** |

**Do not enable** Auth, Database, Domains, Edge Functions, Environment, Organizations, Rest, Secrets, Storage, Analytics, or any **Write** scope.

5. Click **Confirm** / **Create**.

### Immediately after create (still in Dashboard)

6. Copy **Client ID** into the Diagnostics adapter secret environment as `I2_SUPABASE_OAUTH_CLIENT_ID` only.  
   **Do not** paste it into chat, Markdown, or the repository.
7. If the Dashboard shows a **Client Secret**, copy it once into Diagnostics as `I2_SUPABASE_OAUTH_CLIENT_SECRET` only.  
   If the platform does not issue a client secret for this app type, leave that name unset.
8. Set `SUPABASE_DIAGNOSTICS_PROJECT_REF` in Diagnostics to exactly: `wwyxohjnyqnegzbxtuxs`

---

## B. Authorize with the Founder account

1. Keep a local listener ready on `http://127.0.0.1:8765/oauth/callback` (any local one-shot callback you control that can show the redirected URL’s `code` query parameter **only to you on that machine**).
2. In the browser (Founder account), open the authorize URL:

   `https://api.supabase.com/v1/oauth/authorize?response_type=code&client_id=<CLIENT_ID>&redirect_uri=http%3A%2F%2F127.0.0.1%3A8765%2Foauth%2Fcallback`

   Replace `<CLIENT_ID>` with the Client ID from step A6 (locally — do not send it to chat).
3. When prompted, authorize **only** as the Founder account for the organization that owns `wwyxohjnyqnegzbxtuxs`.
4. After redirect, exchange the authorization `code` for tokens via  
   `POST https://api.supabase.com/v1/oauth/token`  
   (`grant_type=authorization_code`, same `redirect_uri`, Basic auth with client id + secret if issued, PKCE if you used it).
5. Store results **only** in the Diagnostics adapter secret environment:
   - `I2_SUPABASE_OAUTH_ACCESS_TOKEN`
   - `I2_SUPABASE_OAUTH_REFRESH_TOKEN`
   - `I2_SUPABASE_OAUTH_TOKEN_EXPIRY` (from the token response expiry / `expires_in`)

**Do not** paste authorization codes, tokens, or secrets into chat, Cursor, Markdown, Baton, Ledger, or the repository.

---

## C. Confirm storage names (values never in repo)

| Inventory name | Required? |
| --- | --- |
| `I2_SUPABASE_OAUTH_CLIENT_ID` | Yes |
| `I2_SUPABASE_OAUTH_CLIENT_SECRET` | Only if issued |
| `I2_SUPABASE_OAUTH_ACCESS_TOKEN` | Yes (after authorize) |
| `I2_SUPABASE_OAUTH_REFRESH_TOKEN` | Yes (after authorize) |
| `I2_SUPABASE_OAUTH_TOKEN_EXPIRY` | Yes (after authorize) |
| `SUPABASE_DIAGNOSTICS_PROJECT_REF` | Yes = `wwyxohjnyqnegzbxtuxs` |

---

## D. Explicit non-actions

Do **not**: grant any other OAuth scope; use PAT; add Dashboard Read-Only member; use service-role; put secrets in chat/repo; expose tokens to the Cursor agent outside the adapter; run B3 live verification under this packet; provision Hostinger; deploy; migrate; mutate production.
