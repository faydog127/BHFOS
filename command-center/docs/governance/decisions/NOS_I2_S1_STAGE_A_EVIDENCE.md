# Stage A Evidence — NOS-I2-S1-EVIDENCE-01

| Field | Value |
| --- | --- |
| Control-plane release | `NOS-I2-S1-EVIDENCE-01` |
| Decision packet | `NOS-R1-S1-I2-CAP-01` Revision 1 |
| Stage | A — repository-only capability preparation |
| Repository | `faydog127/BHFOS` |
| Local branch | `network-os/i2-s1-stage-a` |
| Base SHA | `094345101a9dc8e7c7e627d8e8e77babbb056fcf` |
| Parent of this commit | `094345101a9dc8e7c7e627d8e8e77babbb056fcf` |
| Role | Builder (local only) |
| Evidence classification | LOCAL CONTROL-PLANE VERIFIED; NO HOSTED ACCESS |

This document records Stage A preparation only. It does not authorize push, PR,
merge, credential creation, OAuth consent, hosted calls, aggregate-template
implementation, product implementation, or Release 1 / Slice 1 activation.

## 1. Base confirmation

- Checked-out repository: `faydog127/BHFOS` at `/workspace`
- Local HEAD before Stage A branch: `094345101a9dc8e7c7e627d8e8e77babbb056fcf`
- `origin/network-os/foundation`: `094345101a9dc8e7c7e627d8e8e77babbb056fcf`
- Worktree was clean before branch creation
- Local branch created: `network-os/i2-s1-stage-a`

## 2. Exact files changed

- `command-center/tools/supabase-diagnostics-adapter/catalog-ops.mjs`
- `command-center/tools/supabase-diagnostics-adapter/catalog.self-test.mjs`
- `command-center/tools/supabase-diagnostics-adapter/oauth-helper.self-test.mjs`
- `command-center/tools/supabase-diagnostics-adapter/adapter.mjs`
- `command-center/tools/supabase-diagnostics-adapter/allowlist.json`
- `command-center/tools/supabase-diagnostics-adapter/README.md`
- `command-center/docs/governance/I2_CATALOG_METADATA_CAPABILITY.md`
- `command-center/docs/governance/decisions/NOS_I2_S1_STAGE_A_EVIDENCE.md`
- `command-center/docs/governance/decisions/NOS_I2_S1_STAGE_A_ARCHITECTURE_GUARD_ASSIGNMENT.md`

OAuth helper executable contract (`oauth-helper.mjs`, `oauth-authorize.mjs`) was
inspected and already enforced `projects:read` + `database:read` with omitted-scope
dual attestation. No helper logic rewrite was required.

## 3. OAuth-contract findings

Executable campaign contract for `NOS-I2-S1-EVIDENCE-01`:

| Condition | Required behavior | Source-present result |
| --- | --- | --- |
| Token `scope` present | Accept only `projects:read` and `database:read`; both required | `ALLOWED_SCOPES` and `assertTokenScopes` already implement this |
| Missing either approved scope | Fail closed | `MISSING_PROJECTS_READ` / `MISSING_DATABASE_READ` |
| Additional / write / broader scope | Fail closed | `UNEXPECTED_SCOPE` |
| Ambiguous labels (`projects.read`, `PROJECTS:READ`, `projects_read`) | Fail closed | `UNEXPECTED_SCOPE` (no invented normalization) |
| Token `scope` omitted | Do not treat as unconditional OK; require dual pre-store attestation | `omitted: true` + `attestPreStoreCapabilities` before durable store |
| Dual attestation | Bounded project metadata GET and bounded catalog POST; out-of-ceiling probe must not succeed | Existing helper path preserved |

`buildAuthorizeUrl` does not request scopes on the wire; Dashboard app
configuration remains the selection surface. Founder executable steps already
name Projects Read + Database Read only.

## 4. Historical-versus-current conflict disposition

Conflicts were challenged and recorded. Historical G2.3 records were **not**
rewritten.

| Artifact | Conflict | Disposition |
| --- | --- | --- |
| `SUPABASE_I2_CAPABILITY_VERIFICATION.md` (G2.3B-B2A, 2026-07-17) | Recommends `projects:read` / `projects_read` only; treats `database_read` / Database Read as prohibited | Historical closed-G2.3 evidence. Not executable campaign guidance. Left intact. Campaign ceiling is §3A of `NOS-R1-S1-I2-CAP-01`. |
| `G2.3B-B2B_DECISION_PACKET.md` | Authorizes Option A `projects:read` only | Historical G2.3 authority. Left intact. Not this campaign. |
| `G2.3B-B2D_DECISION_PACKET.md` | Dashboard scope Projects Read only | Historical G2.3 authority. Left intact. Not this campaign. |
| `G2.3B-B2D_OAUTH_HELPER_ARCHITECTURE_GUARD_ASSIGNMENT.md` | Founder actions: Projects Read only | Historical assignment. Left intact. |
| `G2.3B-B2_DECISION_PACKET.md` | Candidate permissions include older Projects-Read-first wording | Historical G2.3 planning. Left intact. |
| `SUPABASE_OAUTH_FOUNDER_STEPS.md` | Already `projects:read` + `database:read` | Current executable campaign guidance. No change. |
| `I2_PROVISIONING_CHECKLIST.md` | Already campaign ceiling Projects Read + Database Read | Current executable campaign guidance. No change. |
| `DIAGNOSTICS_ACCESS.md` / `DIAGNOSTICS_RUNBOOK.md` | Do not instruct this campaign to request Projects-Read-only | Current operating docs already distinguish `NOS-I2-S1-EVIDENCE-01`. No change. |
| `oauth-helper.mjs` / adapter README | Already both scopes + omitted-scope attestation | Current executable contract. Tests strengthened; no scope-string rewrite. |

Closed G2.3 is not reopened. Management API permission labels such as
`project_admin_read` and `database_read` remain platform evidence names, not
substitute OAuth scope selections.

## 5. Dependency-operation contract

| Field | Contract |
| --- | --- |
| Operation id | `catalog_object_dependencies` |
| Transport | Existing `POST /v1/projects/{ref}/database/query/read-only` |
| SQL | Adapter-owned SELECT-only templates from `pg_catalog` only |
| Input | `schema` (must be `public`) + `table` (must be an approved Slice 1 relation) |
| Approved input relations | `organizations`, `accounts`, `contacts`, `properties`, `leads`, `services_catalog`, `price_book`, `events`, `crm_tasks`, `app_user_roles`, `tenants` |
| Permitted output fields | `dependency_identity`, `dependency_type` |
| Output may include | The approved object and its direct public catalog dependencies (relation / function / trigger / constraint / policy / index / sequence) |
| Denied | Agent SQL; unexpected params; non-public schemas; non-Slice-1 tables; prohibited identifiers; injection strings; business-table row fields; function bodies; definitions; OIDs; non-public identities |
| Aggregates | No Slice 1 aggregate templates added. Existing S2 quotes aggregate left unchanged. |

Project ref remains hard-locked to `wwyxohjnyqnegzbxtuxs`.

## 6. Tests executed

```text
node command-center/tools/supabase-diagnostics-adapter/cli.mjs --self-test
node command-center/tools/supabase-diagnostics-adapter/catalog.self-test.mjs
node command-center/tools/supabase-diagnostics-adapter/oauth-helper.self-test.mjs
git diff --check
```

Results:

- `cli.mjs --self-test`: PASS (`ok: true`, `failed: []`; catalog ops registered = 12)
- `catalog.self-test.mjs`: PASS (`ok: true`, `failed: []`)
- `oauth-helper.self-test.mjs`: PASS (`ok: true`, `failed: []`)
- `git diff --check`: PASS (no whitespace errors)

Focused proofs added for: both approved scopes pass; either approved scope alone fails;
additional/write/ambiguous scopes fail; omitted scope requires dual attestation;
unknown dependency operations fail; unexpected parameters fail; non-public
schemas fail; prohibited identifiers and SQL-injection inputs fail; dependency
output is sanitized; dependency capability cannot return business rows; mutation
keywords and non-SELECT templates fail.

## 7. Explicit non-actions

Confirmed:

- no credential created, requested, inspected, or used;
- no hosted Supabase, Cloudflare, or other environment call;
- no OAuth authorize / consent / `FOUNDER_RUN_READY` run;
- no Slice 1 aggregate template added;
- no Network OS product feature implemented;
- no DDL, DML, migration, deploy, or environment mutation;
- no agent-provided SQL accepted;
- no customer row extracted;
- no push;
- no remote branch created by this Stage A work;
- no pull request created;
- no merge;
- no force or history rewrite;
- Release 1 / Slice 1 not activated.
