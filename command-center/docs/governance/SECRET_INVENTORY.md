# Secret Inventory (names only)

> **BHFOS Operating Model v2.2 — G2.3A foundations.** This is a **names-only**
> inventory of secrets and configuration variables. It records *that* a secret
> exists and how it is owned, stored, rotated, and revoked — **never its value.**
>
> **This file MUST NEVER contain:** secret values, tokens, passwords, connection
> strings, private keys, service-role keys, or raw `.env` contents. Any item not
> confirmed from the repository alone is marked `unknown` / `unverified` — it is
> never guessed.
>
> Maintenance: agent-maintained. The founder never edits this file.

## Legend

- **Environment:** where the secret is used (`production`, `ci`, `local`,
  `backend` = Supabase Edge Function secret store).
- **Verified?:** `yes` = confirmed present/used from repository evidence;
  `unverified` = referenced but not confirmed from the repo alone; `unknown` =
  existence/location not determinable from the repository.
- All storage locations are described by category (e.g. "operator local env /
  secret store"), never by path-to-a-value.

## Frontend / deploy operations

| Name | Owning system | Purpose | Environment | Expected storage | Responsible role | Rotation requirement | Revocation method | Verified? | Notes (non-sensitive) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `HOSTINGER_API_TOKEN` | Hostinger | Authenticates static deploy / file upload to `public_html` | production (operator local) | Operator local env / secret store | Founder (delegated to Production Operator in G2.3C) | Documented cadence + immediate revoke on suspicion | Revoke/regenerate in Hostinger account | unverified | Read from env by the deploy tooling; masked, never logged. Not provisioned as a scoped agent token yet. |
| `HOSTINGER_USERNAME` | Hostinger | Optional account/username hint for deploy target | production (operator local) | Operator local env | Founder | n/a (identifier, not a secret) | n/a | unknown | Optional; resolved via API when absent. Identifier, not a credential value. |
| `HOSTINGER_DOMAIN` | Hostinger | Optional deploy domain override | production (operator local) | Operator local env | Founder | n/a | n/a | unknown | Defaults to `app.bhfos.com`. Non-secret. |

## Supabase / backend

| Name | Owning system | Purpose | Environment | Expected storage | Responsible role | Rotation requirement | Revocation method | Verified? | Notes (non-sensitive) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase | Public project URL for the client | production, local | `.env` (gitignored) / build env | Founder | n/a (public URL) | n/a | yes | Client-exposed; on the reviewed `VITE_` allowlist. Non-secret. |
| `VITE_SUPABASE_ANON_KEY` | Supabase | Public anon key for the client | production, local | `.env` (gitignored) / build env | Founder | On Supabase key rotation | Rotate anon key in Supabase | yes | Client-exposed anon key (public by design). On the `VITE_` allowlist. |
| `SUPABASE_URL` | Supabase | Server-side project URL | backend | Supabase secret store | Founder | n/a | n/a | unverified | Backend/edge context. Non-secret URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Elevated server-side data access | backend | Supabase secret store (backend only) | Founder | Documented cadence + immediate revoke | Rotate service-role key in Supabase | unverified | **Highly sensitive.** Backend-only; must never reach the frontend or repo. Referenced by feature docs; not confirmed from repo. |
| `SUPABASE_ACCESS_TOKEN` | Supabase | CLI/management access (migrations, functions) | local (operator) | Operator local env / secret store | Founder | Documented cadence + immediate revoke | Revoke in Supabase account | unverified | Used for CLI/management; not for runtime. |

## Runtime configuration (client-exposed, non-secret unless noted)

| Name | Owning system | Purpose | Environment | Expected storage | Responsible role | Rotation requirement | Revocation method | Verified? | Notes (non-sensitive) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `VITE_API_BASE_URL` | App | Client API base URL | production, local | `.env` / build env | Founder | n/a | n/a | yes | On the `VITE_` allowlist. Non-secret. |
| `VITE_WS_URL` | App | Client websocket URL | production, local | `.env` / build env | Founder | n/a | n/a | yes | On the `VITE_` allowlist. Non-secret. |
| `VITE_TENANT_ID` / `VITE_DEFAULT_TENANT` | App | Tenant selection | production, local | `.env` / build env | Founder | n/a | n/a | yes | On the `VITE_` allowlist. Non-secret identifiers. |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps | Client maps key | production, local | `.env` / build env | Founder | Per Google key policy | Revoke/rotate in Google Cloud console | yes | Client-exposed by design; restrict by referrer/domain. On the `VITE_` allowlist. |
| `VITE_GOOGLE_REVIEW_URL` | App | Review link | production, local | `.env` / build env | Founder | n/a | n/a | yes | Non-secret URL. On the `VITE_` allowlist. |
| `VITE_BUILD_STAMP` | App | Injected build stamp for identity | production, ci, local | Build env | Build tooling | n/a | n/a | yes | Non-secret build metadata. On the `VITE_` allowlist. |

## Backend feature secrets (referenced by app; backend-only)

| Name | Owning system | Purpose | Environment | Expected storage | Responsible role | Rotation requirement | Revocation method | Verified? | Notes (non-sensitive) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI | Server-side AI features | backend | Supabase secret store (backend only) | Founder | Documented cadence + immediate revoke | Revoke/rotate in OpenAI dashboard | unverified | Backend-only. `VITE_OPENAI_API_KEY` is explicitly disallowed in frontend builds. |
| `RESEND_API_KEY` | Resend | Transactional email | backend | Supabase secret store (backend only) | Founder | Documented cadence | Revoke/rotate in Resend | unknown | Referenced by marketing feature docs; backend-only. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe | Payments + webhook verification | backend | Supabase secret store (backend only) | Founder | Documented cadence + immediate revoke | Revoke/rotate in Stripe dashboard | unknown | Financial. Backend-only. Routine testing uses synthetic simulation, never live charges. |
| `GOOGLE_MAPS_API_KEY` | Google | Server-side places/geocoding | backend | Supabase secret store (backend only) | Founder | Per Google key policy | Revoke/rotate in Google Cloud console | unknown | Distinct from the client `VITE_GOOGLE_MAPS_API_KEY`. |

## Handling rules (binding)

1. Values are stored only in a secret store or a gitignored local `.env`, never
   in the repository, prompts, Markdown, chat, or logs.
2. No agent reads a raw secret value. The deploy tooling loads the token from the
   environment and masks it in output.
3. Service-role and financial keys are backend-only and must never reach the
   frontend bundle (enforced by the `VITE_` allowlist and the `dist` secret scan).
4. Unknown/unverified items are scheduled for confirmation in the G2.3B read-only
   diagnostics phase; they are never guessed here.
