# BHFOS Network OS — Release 1 / Slice 1 Hosted-Schema Evidence Attempt

| Field | Value |
| --- | --- |
| Status | CAPABILITY WORKSTREAM APPROVED; LIVE CHECK REMAINS UNAVAILABLE |
| Date | 2026-08-22 |
| Product | Network OS |
| Release / Slice | Release 1 / Slice 1 — Customer Network + Service Need Foundation |
| Role / identity | Production Diagnostics / I2 required; no live identity available |
| Environment requested | Hosted production Supabase metadata only |
| System | Supabase project locked by adapter to `wwyxohjnyqnegzbxtuxs` |
| Authorization reference | Founder authorization in Command Center conversation, 2026-08-22 |
| Evidence classification | LOCAL CONTROL-PLANE VERIFIED; HOSTED UNREACHED |
| Repository HEAD at attempt | `b6d94e574c83c8970fcadaac01515a6c5097dc57` |
| Implementation authority | Diagnostics control-plane work only under `NOS-R1-S1-I2-CAP-01`; no Network OS product implementation |

## 1. Authorized boundary

The Founder authorized:

> Authorize read-only hosted-schema evidence collection for the identified Slice 1 objects. Permit schema metadata, policies, grants, dependencies, and aggregate data-quality counts only. Do not permit customer-row extraction, DDL, DML, migrations, secrets, or environment mutation.

This authorization did not authorize credential provisioning, OAuth application creation, use of founder-personal/shared-admin credentials, service-role access, arbitrary SQL, adapter expansion, or mutation testing through a path capable of writing.

## 2. Preconditions checked

| Precondition | Result | Evidence classification |
| --- | --- | --- |
| Protected Supabase diagnostics adapter exists | PASS | SOURCE-PRESENT |
| Adapter project ref is hard-locked | PASS — `wwyxohjnyqnegzbxtuxs` | LOCAL VERIFIED |
| Adapter denies agent-provided SQL | PASS | LOCAL VERIFIED |
| Adapter denies writable database query path | PASS | LOCAL VERIFIED |
| Adapter denies `execute-sql`, secrets, API keys, functions, project listing, and arbitrary paths | PASS | LOCAL VERIFIED |
| Adapter self-test | PASS — no failures | LOCAL VERIFIED |
| Catalog template self-test | PASS — no failures | LOCAL VERIFIED |
| Dedicated I2 OAuth access token present | FAIL — absent; value not requested or displayed | NAME-PRESENCE CHECK ONLY |
| External diagnostics secret-env path present | FAIL — absent | NAME-PRESENCE CHECK ONLY |
| Token expiry/refresh lifecycle metadata present | FAIL — absent | NAME-PRESENCE CHECK ONLY |
| `SUPABASE_DIAGNOSTICS_PROJECT_REF` environment binding present | FAIL — absent; adapter remains internally hard-locked | NAME-PRESENCE CHECK ONLY |
| Prior B3 live read/negative-write acceptance evidence | NOT ESTABLISHED | REPOSITORY GOVERNANCE EVIDENCE |

No environment-variable values, secret-store contents, tokens, or credentials were displayed.

## 3. Commands executed

The following local, non-network control-plane tests were executed:

```text
node tools/supabase-diagnostics-adapter/cli.mjs --self-test
node tools/supabase-diagnostics-adapter/catalog.self-test.mjs
node tools/supabase-diagnostics-adapter/cli.mjs --help
```

Results:

- adapter self-test: PASS;
- catalog template self-test: PASS;
- registered catalog operations: 11;
- no live Supabase request attempted;
- no credential loaded;
- no SQL supplied by the agent;
- no customer data accessed.

## 4. Current adapter coverage versus authorized evidence

### Available protected metadata templates

- relation existence;
- RLS flags;
- policies;
- grants;
- columns;
- indexes;
- constraints;
- triggers;
- named function signature;
- migration history.

These templates can support most of the authorized schema-metadata collection after a valid I2 database-read credential exists.

### Aggregate data-quality gap

The adapter currently exposes only one hard-coded aggregate row-count operation for a legacy quotes uniqueness check. It does not expose bounded aggregate templates for the authorized Slice 1 objects:

- `organizations`;
- `accounts`;
- `contacts`;
- `properties`;
- `leads`;
- `services_catalog`;
- `price_book`;
- `events`;
- `crm_tasks`;
- `app_user_roles`;
- `tenants`.

The Founder authorization permits aggregate counts, but the current adapter capability does not. Authorization alone does not bypass the adapter allowlist. Adding new aggregate templates requires a separate controlled diagnostics-capability change and review.

## 5. Stop condition

The live check stopped before network access because the repository's Production Diagnostics preconditions require a dedicated, attributable, read-only I2 identity and explicitly prohibit:

- service-role keys for routine diagnostics;
- founder-personal or shared-admin credentials;
- arbitrary SQL;
- dashboard table browsing;
- `execute-sql`;
- unsafe fallback when read-only enforcement is unavailable.

The required I2 Supabase OAuth lifecycle credentials are recorded in the repository inventory as not issued, and none are present in this workspace.

## 6. Observed result

| Field | Result |
| --- | --- |
| Hosted project reached | No |
| Schema metadata collected | No |
| Policies/grants/dependencies collected | No |
| Aggregate counts collected | No |
| Customer rows accessed | No |
| DDL/DML/migration executed | No |
| Secrets accessed or displayed | No |
| Environment mutated | No |
| Stop condition hit | Yes — dedicated read-only I2 capability unavailable |
| Confidence | High |

## 7. Governance status

**FOUNDER_RUN_BLOCKED.** The Founder must not be asked to run SQL, browse tables, paste schema output, supply a personal token, or diagnose the credential path.

The source-only dependency inventory remains valid. The hosted-schema evidence gate remains BLOCKED and must not be treated as failed database behavior; the hosted environment was not reached.

## 8. Required capability provisioning

Before the authorized live collection can run, a controlled provisioning workstream must establish:

1. corrected G2.3B-B2D authority for the dedicated Supabase diagnostics OAuth lifecycle;
2. applicable Architecture Guard approval for the exact protected execution design/SHA;
3. I2 OAuth application/client configuration using only Projects Read and Database Read;
4. external diagnostics secret storage with no values in the repository or chat;
5. protected OAuth helper readiness ending in `FOUNDER_RUN_READY` before any unavoidable consent action;
6. B3 live project/database read attestation and fail-closed negative capability evidence;
7. attributable I2 audit identity;
8. bounded aggregate-count templates for the approved Slice 1 tables, separately reviewed to prove they cannot return row data.

## 9. Exact next controlled action

The Founder approved `NOS-R1-S1-I2-CAP-01`, the **Supabase I2 Diagnostics Capability Provisioning and Slice 1 Aggregate-Template Decision Packet**, on 2026-08-22.

The exact next action is a bounded **local Stage A Builder assignment** for OAuth-scope reconciliation and any missing fixed metadata/dependency capability, followed—only after separate push/PR authorization—by independent exact-head Architecture Guard review. After merge and `FOUNDER_RUN_READY`, Stage B may provision the campaign identity and collect metadata. Aggregate-template design and review occur only afterward in Stage C; aggregate collection and mandatory revocation occur in Stage D.

No credential creation, OAuth consent, live call, push, PR, merge, aggregate implementation, or aggregate use may occur from this evidence-attempt record alone.

## 10. Explicit non-actions

- [x] No deploy
- [x] No migration
- [x] No database write
- [x] No DDL or DML
- [x] No `execute-sql` invocation
- [x] No service-role use
- [x] No secret values recorded
- [x] No raw logs pasted
- [x] No customer impersonation
- [x] No customer-row extraction

## 11. Exact stopping point

Stopped after local fail-closed adapter tests and credential-name presence checks, before any live Supabase request.
