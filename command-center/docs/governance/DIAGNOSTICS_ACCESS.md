# Diagnostics Access Specification — I2 Production Diagnostics

> **BHFOS Operating Model v2.2 — G2.3B-B1.** Repository specification only.
> Defines least-privilege **Production Diagnostics (I2)** access boundaries,
> log-masking rules, and negative-test requirements.
>
> **This document does not grant access.** No credential is provisioned by this
> file. Live use requires separate Founder authorization for G2.3B-B2 onward.
>
> **Content rules:** no credential values, no token fragments, no passwords, no
> private keys, no connection strings, no raw logs, no customer data, no
> realistic PII examples.

---

## 1. Purpose and status

| Field | Value |
| --- | --- |
| Identity | **I2 — Production Diagnostics** |
| Role definition | `command-center/.cursor/agents/production-diagnostics.md` |
| Access matrix | `PRODUCTION_ACCESS_MATRIX.md` (PD = read-only by default) |
| Phase that authors this spec | **G2.3B-B1** (Tier 1, repository-only) |
| Phase that may provision | **G2.3B-B2** (Tier 3 — separate authorization) |
| Live access under B1 | **None** |

The founder must not become the log reader, account configurator, credential
courier, schema investigator, Edge Function inventory auditor, branch-protection
verifier, or production diagnostics technician. Agents perform authorized
mechanics later under exact authorization.

---

## 2. Eight diagnostic surfaces (REACHABLE target — B3/B4 only)

1. GitHub workflow / PR / check / branch-protection state
2. Hostinger deployment state / logs / version identity
3. Supabase project and platform logs (app, auth, DB) — masked
4. Edge Function logs and inventory — masked; no mutating invocation
5. Migration / schema **metadata** state
6. Deployed build identity (`build-info.json`)
7. Health verification (non-destructive)
8. Browser / network diagnostics (no customer impersonation)

B1 does **not** claim any surface has been reached.

---

## 3. Global prohibitions (all systems)

I2 must never:

- Deploy, upload, delete, or mutate hosting artifacts
- Run or apply migrations
- Perform SQL writes, DDL, or mutating RPCs
- Invoke `execute-sql`
- Use `SUPABASE_SERVICE_ROLE_KEY` for routine diagnostics
- Read, paste, or store secret **values** in repo, chat, Baton, Ledger, or PRs
- Change GitHub / Hostinger / Supabase security or settings
- Perform financial actions or customer communications
- Impersonate real customers or bypass authentication
- Retain unmasked customer data

Founder personal accounts, shared admin credentials, and unrestricted
service-role credentials are **forbidden** as standing I2 identities.

---

## 4. Per-system identity and permission specification

Unknown platform capabilities are labeled `unknown` / `unverified`. Do not guess.

### 4.1 GitHub (`faydog127/BHFOS`)

| Field | Specification |
| --- | --- |
| Identity / token type | Fine-grained PAT **or** GitHub App installation dedicated to I2 |
| Environment | production (ops) |
| Auth method | Token / App JWT |
| Storage category | Secret store (names only in `SECRET_INVENTORY.md`) |
| Audit attribution | Distinct bot/App identity visible in GitHub audit log |
| Rotation | Documented cadence + immediate revoke on suspicion |
| Expiration | Prefer short TTL where supported |
| Emergency disable | Revoke token and/or disable App installation |

**Allowed (read-only):**

| Action | Allowed? |
| --- | --- |
| Read PR state | Yes |
| Read workflow / check state | Yes |
| Read workflow logs | Yes (mask before any copy) |
| Read branch-protection / ruleset state | Yes (Administration: Read if available) |
| Read deployment history where available | Yes |
| Contents: Read; Metadata: Read; Actions: Read; PRs: Read; Commit statuses: Read | Yes |

**Prohibited:**

| Action | Allowed? |
| --- | --- |
| Repository write / Contents write | No |
| Workflow dispatch | No |
| Workflow cancellation | No |
| Settings mutation / Administration write | No |
| Secrets write | No |
| Workflow file write | No |
| Force-push, delete branch, merge | No |

**Negative test (B3):** attempt a Contents write or settings PATCH → expect
`401`/`403`. Record result by reference only.

**Acceptance evidence (B3):** successful read of PR/check state attributable to
I2 identity; negative write test failed closed.

### 4.2 Hostinger (static host for `app.bhfos.com`)

| Field | Specification |
| --- | --- |
| Identity / token type | Scoped **read** API token **if platform supports**; else dedicated read-only dashboard role for I2 |
| Environment | production |
| Auth method | Token / SSO role |
| Storage category | Secret store |
| Audit attribution | Named I2 identity (`unverified` until B2 confirms platform supports it) |
| Rotation | Cadence + on suspicion |
| Expiration | Prefer short TTL |
| Emergency disable | Revoke token / remove role |
| Platform read-API support | **unknown** until B2 — stop rather than fall back to shared admin |

**Allowed:**

| Action | Allowed? |
| --- | --- |
| Read deployment history | Yes |
| Read deployment status | Yes |
| Read deployment logs | Yes (mask before copy) |
| Read active artifact / version identity | Yes |
| Read hosting errors | Yes |

**Prohibited:**

| Action | Allowed? |
| --- | --- |
| Upload | No |
| Deployment / mutating publish | No |
| Deletion | No |
| DNS / hosting configuration mutation | No |
| Billing mutation | No |

**Negative test (B3):** attempt upload or file mutation → expect denial.

**Acceptance evidence (B3):** read of deployment status/history attributable to
I2; negative mutation test failed closed. If only shared-admin login works →
**stop** (do not accept I2).

### 4.3 Supabase (project used by production app)

| Field | Specification |
| --- | --- |
| Identity / token type | Dedicated read-only member and/or management token for logs/metadata |
| Environment | production |
| Auth method | Token / project member role |
| Storage category | Secret store |
| Audit attribution | Named I2 identity |
| Rotation | Cadence + on suspicion |
| Expiration | Prefer short TTL |
| Emergency disable | Revoke token / demote or remove member |
| Service-role for routine diagnostics | **Forbidden** |

**Allowed:**

| Action | Allowed? |
| --- | --- |
| Read project status | Yes |
| Read Edge Function logs | Yes (mask) |
| Read authentication logs | Yes (mask) |
| Read database logs | Yes (mask) |
| Read migration metadata / history | Yes |
| Read schema metadata (tables/columns/indexes/constraints/policies/enums — metadata only) | Yes |
| Read function inventory (names, timestamps, status) | Yes |
| Approved **metadata-only** diagnostic queries (no row data from business tables) | Yes, when explicitly listed in a later B4 authorization |

**Prohibited:**

| Action | Allowed? |
| --- | --- |
| Service-role key use | No |
| Arbitrary SQL | No |
| Table-data browsing / SELECT of customer or financial rows | No |
| Database write / DDL | No |
| Function deploy, disable, delete, or mutating invoke | No |
| `execute-sql` invocation | No |
| Secret create/update | No |
| Storage writes | No |

**Negative test (B3):** attempt insert/update/delete, function deploy, or
`execute-sql` invoke → expect denial. Never use a successful mutation path.

**Acceptance evidence (B3):** read of project status and at least one log surface
(reference only); negative mutation tests failed closed; no service-role used.

### 4.4 Application build identity and health

| Field | Specification |
| --- | --- |
| Identity | None (anonymous HTTPS GET) |
| Environment | production |
| Auth method | HTTPS |
| Storage | N/A |

**Allowed:** GET `build-info.json` (documented path under the production site);
run non-destructive `health-probe` against production URL when separately
authorized in B3/B4.

**Prohibited:** authenticated mutating API calls; auth bypass; POST/PUT/PATCH/
DELETE against application APIs as part of routine diagnostics.

**Negative test (B3):** health probe / diagnostics session must not issue
mutating HTTP methods to application APIs.

### 4.5 Browser diagnostics

| Field | Specification |
| --- | --- |
| Identity | Human or agent browser session **without** customer impersonation |
| Environment | production |
| Auth method | Browser; no stolen cookies; no privilege escalation |

**Allowed:** inspect console errors, network failures, response codes,
correlation identifiers (mask before copy).

**Prohibited:** customer-session impersonation; authentication bypass;
real-customer workflow execution; exporting cookies/tokens into artifacts;
mutation via the UI beyond anonymous/public read needed for the investigation.

**Negative test (B3):** confirm no cookie/token values appear in evidence
artifacts; no impersonation attempted.

---

## 5. Log masking and sensitive-data handling (binding)

### 5.1 Data classes that must be masked or omitted

- Customer names, addresses, emails, phone numbers
- Authentication identifiers (user ids, session ids) — truncate or hash if needed
- Request and response payloads
- Financial metadata (amounts may be summarized; never paste full payment objects)
- Cookies, tokens, authorization headers
- Stack traces that embed secrets or PII
- SQL text or database row details beyond schema metadata names

### 5.2 Binding rules

1. **Minimum necessary access** for the authorized investigation only.
2. **Mask before** evidence leaves the native platform UI.
3. **No raw logs** in Markdown, Baton, Ledger, Decision Packet, PR comment, or chat.
4. **No secret values** in any repository or chat artifact.
5. **No unnecessary customer-data retention.**
6. Prefer **platform-native references** (system, project, time window, request id,
   run id) instead of copied log bodies.
7. **Stop and escalate** if logs expose unexpected sensitive data beyond need.
8. **Retention:** masked evidence retained ≤ **30 days** unless an open incident
   or Ledger entry requires longer; then delete or re-mask at close.
9. **Deletion / expiration:** PD or Release Agent removes masked working copies
   at retention expiry; record deletion by reference on the Ledger when it is a
   consequential cleanup action under authorization.
10. **Audit attribution:** every diagnostics session records role `PD` / identity
    `I2` and authorization reference on the evidence template (never token values).

### 5.3 Example placeholders (synthetic only)

Use only clearly fake placeholders such as `[REDACTED_EMAIL]`,
`[REDACTED_NAME]`, `customer_id=[REDACTED]`, `Authorization=[REDACTED]`.
Do **not** invent realistic names, emails, phones, or addresses.

---

## 6. Credential storage and revocation (requirements for B2/B5)

- Store values only in an approved secret-store category or gitignored operator
  env — never in the repository.
- Inventory records **names only** (`SECRET_INVENTORY.md`).
- Rotation and revocation procedures: see `I2_PROVISIONING_CHECKLIST.md` and
  `I2_REVOCATION_CHECKLIST.md`.
- Standing I2 access must not remain after B5 revocation test without a new
  Founder authorization.

---

## 7. Negative testing requirements (B3)

Before I2 access is accepted:

| System | Required negative result |
| --- | --- |
| GitHub | Write / settings mutation denied |
| Hostinger | Upload / deploy / delete denied |
| Supabase | Write / DDL / deploy / `execute-sql` denied; no service-role |
| App / health | No mutating HTTP methods |
| Browser | No token/cookie export; no impersonation |

If any negative test unexpectedly **succeeds** (write allowed) → **stop**, revoke,
and escalate. Do not continue under G2.3B authorization.

---

## 8. Audit attribution requirements

- Platform actions must be attributable to the dedicated I2 identity, not the
  founder personal account (except one-time Founder-performed provisioning in B2
  when unavoidable human interaction is required).
- Evidence templates and Ledger entries reference identity name and authorization
  id — never secret values.
- If audit attribution is unavailable → **stop** (brief stop condition).

---

## 9. B2–B5 entry criteria (from this spec)

| Phase | Entry requires |
| --- | --- |
| B2 | B1 merged; Founder B2 Decision Packet; this access matrix accepted |
| B3 | B2 complete; I2 names in inventory; no values in repo |
| B4 | B3 negative tests passed; formal reconciliation procedures in `RECONCILIATION_G2-3B.md` |
| B5 | B4 gates resolved or formally attested |

---

## 10. Stop conditions

Stop provisioning or diagnostics when any condition in G2.3B brief Section 18
occurs, including: over-scoped tokens, admin login required for standing I2,
unenforceable read-only, secret leakage, successful writes, unreconciled gates
without attestation, or scope creep into deploy/migrate/repair.

---

## 11. Related artifacts

- `DIAGNOSTICS_RUNBOOK.md`
- `RECONCILIATION_G2-3B.md`
- `EXECUTE_SQL_REVIEW.md`
- `I2_PROVISIONING_CHECKLIST.md`
- `I2_REVOCATION_CHECKLIST.md`
- `templates/DIAGNOSTICS_EVIDENCE.template.md`
- `SECRET_INVENTORY.md`
