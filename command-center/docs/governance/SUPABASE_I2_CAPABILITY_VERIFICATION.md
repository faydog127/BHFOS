# G2.3B-B2A — Supabase I2 Capability Verification (no credential issued)

> **Evidence artifact.** Names and permission identifiers only. No secret values.
> Authorized under Founder G2.3B-B2A: capability verification only — **do not issue**
> a Supabase token from this document.

## 1. Verification method

Read-only review of official Supabase Management API reference and OAuth scope
docs (fetched 2026-07-17). No live Management API calls. No Dashboard mutation.
No token created.

## 2. Credential types available (platform)

| Type | Fine-grained permissions honored? | Project-scopable? | Status for I2 |
| --- | --- | --- | --- |
| **Personal access token (PAT)** | **No** — account-wide privileges of the creating user | **No** (account/org-wide) | **PROHIBITED** by B2A |
| **OAuth2 app token** | **Yes** — scopes / FGA permissions granted at authorize time | Via user authorization of the app (org/project as authorized) | **Only officially supported fine-grained mechanism** documented for Management API |
| Generic Dashboard **Read-Only** member | N/A (Dashboard role, not Management API FGA) | Project member | **PROHIBITED** by B2A |
| Service-role key | N/A | Project runtime | **PROHIBITED** |

**Conclusion:** The exact supported fine-grained credential type for least-privilege
Management API access is an **OAuth2 application token** (not a PAT). Token
lifetime for OAuth access tokens is **short-lived**; refresh tokens are used to
rotate access tokens. Exact TTL is platform-controlled (short-lived access;
refresh until revoked).

## 3. Candidate permission identifiers (FGA) vs OAuth scopes

**Do not treat these as interchangeable labels.**

| Layer | Example | Where selected / used |
| --- | --- | --- |
| Dashboard OAuth app scope | Category **Projects** + type **Read** → wire scope **`projects:read`** | Supabase Dashboard OAuth Apps UI |
| Management API permission identifiers | `projects_read`, `project_admin_read`, … | Endpoint FGA docs / API authorization — **not** Dashboard checkbox synonyms for `projects:read` |

| Desired I2 surface | Dashboard OAuth selection | Wire OAuth scope | Management API permission id examples (docs) | Issue? |
| --- | --- | --- | --- | --- |
| Project status / health / metadata (adapter-bounded) | Projects **Read** | `projects:read` | `projects_read` (and related endpoint ids; may also cover listing/network/upgrade reads) | Candidate for corrected B2D Option A **with residual token-scope risk** |
| Analytics / unified logs | Analytics **Read** (if offered) | `analytics:read` | `analytics_logs_read` | **High sensitivity** — see §5 |
| Edge Function inventory / metadata | Edge Functions **Read** | `edge_functions:read` | `edge_functions_read` | **Includes function body** — see §6 |
| Migration version list | Database **Read** (partner note) | `database:read` | `database_migrations_read` | Endpoint marked **“Only available to selected partner OAuth apps”** — treat as **unavailable** unless partner entitlement proven |
| Schema / SQL / table data | — | — | `database_read` | **PROHIBITED** |
| Secrets / API keys | Secrets **Read** | `secrets:read` | `secrets:read` (+ related) | **PROHIBITED** |
| Function deploy/update/delete | Edge Functions **Write** | `edge_functions:write` | `edge_functions_write` | **PROHIBITED** |

**Project scoping note:** OAuth-account authorization and OAuth scope boundaries are
**not** independently verified as token-level single-project restriction. Adapter
project-ref lock (`wwyxohjnyqnegzbxtuxs`) is a separate process control.

## 4. Endpoints enabled by proposed permissions (non-exhaustive; from Management API docs)

### 4.1 Projects Read / wire scope `projects:read` (Management API ids may include `projects_read`)
Enables (examples from platform docs — **broader than** the adapter allowlist):
list/get projects; project metadata; service health; network restrictions/bans
(read); upgrade eligibility; org project list (with org-related permissions where
required). Does **not** by itself enable secrets, SQL, or function deploy.

**I2 adapter** must still expose only approved allowlisted paths for fixed ref
`wwyxohjnyqnegzbxtuxs`. Do **not** claim the OAuth token is project-scoped.

### 4.2 `analytics_logs_read`
Enables:
- `GET /v1/projects/{ref}/analytics/endpoints/logs` — unified log stream; optional
  ClickHouse **SQL**/LQL; sources include `edge_logs`, `postgres_logs`, etc.
- `GET /v1/projects/{ref}/analytics/endpoints/logs.all` (deprecated) — log SQL;
  default edge_logs unless `sql` provided.

### 4.3 `edge_functions_read`
Enables:
- `GET /v1/projects/{ref}/functions` — list functions (inventory)
- `GET /v1/projects/{ref}/functions/{slug}` — function metadata
- `GET /v1/projects/{ref}/functions/{slug}/body` — **deployed function source body**

### 4.4 Explicitly excluded permissions (must not be granted)
| Permission | Example endpoints enabled |
| --- | --- |
| `secrets:read` | List secrets; get API keys; signing-key info |
| `secrets:write` / `edge_functions_secrets_write` | Create/update/delete secrets |
| `database_read` | Run SQL (`supabase_read_only_user` / run sql); OpenAPI; TS types; configs overlapping data plane |
| `database_write` / `database_migrations_write` | Migrations apply/patch; writes |
| `edge_functions_write` | Create/deploy/update/delete/bulk-update functions |
| Auth config write / user browsing scopes | Auth configuration mutation; user-data surfaces |

## 5. Does `analytics_logs_read` permit sensitive log access?

**Yes.** The unified logs endpoint accepts queries over sources such as
`postgres_logs` and `edge_logs` and allows custom ClickHouse SQL. Production logs
can contain request paths, identifiers, and other sensitive content. Platform
FGA does **not** provide a separate “masked-logs-only” permission. Safe use
requires operational masking/retention rules (already in `DIAGNOSTICS_ACCESS.md`)
and should be a **separate Founder decision**, not bundled as harmless metadata.

## 6. Does `edge_functions_read` permit deployed source-body retrieval?

**Yes.** The same permission that lists functions also enables
`GET .../functions/{slug}/body` (“Retrieve a function body”). There is **no**
documented FGA split between inventory metadata and source body. Granting
`edge_functions_read` technically enables source retrieval; operational “don’t
call /body” is policy-only, not platform enforcement.

## 7. Audit attribution and revocation

| Field | Documented expectation |
| --- | --- |
| Audit | OAuth app identity / authorization; actions via Management API attributable to the app token (not founder-personal PAT) |
| Revocation | Revoke OAuth app authorization; rotate/delete client credentials; refresh tokens stop working when authorization revoked |
| Lifetime | Short-lived access tokens; refresh until revoked |

## 8. Proof summary (exclusions)

| Capability | Excluded if these permissions are omitted? |
| --- | --- |
| Secrets / API keys | Yes — omit `secrets:read` / Secrets Read scope |
| `database_read` / SQL execution / table data | Yes — omit `database_read` and Database Read scope; do not use Dashboard SQL |
| `database_write` / DDL / migration apply | Yes — omit write permissions |
| Auth-user data browsing | Yes — omit Auth read/write scopes not required for I2 |
| Configuration mutation | Yes — omit write scopes |
| Edge Function mutation | Yes — omit `edge_functions_write` |
| Function **source body** | **No** — still enabled by `edge_functions_read` |
| Sensitive log content | **No** — still enabled by `analytics_logs_read` |

## 9. Recommendation input for Founder Decision Packet G2.3B-B2B

Do **not** issue any Supabase credential under B2A.

Propose a separate packet that may authorize **at most**:
1. OAuth2 app token (never PAT / never Dashboard Read-Only / never service-role)
2. Scopes/permissions: **`projects:read` / `projects_read` only** as the first
   issueable ceiling; **or** add `edge_functions_read` / `analytics_logs_read`
   only with explicit Founder acceptance of body retrieval and sensitive log risk.

Defer migration metadata if `database_migrations_read` remains partner-gated.
Defer schema metadata to B4 (as previously directed).
