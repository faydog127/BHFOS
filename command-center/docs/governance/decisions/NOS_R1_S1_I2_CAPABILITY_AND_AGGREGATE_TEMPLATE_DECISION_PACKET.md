# Decision Packet — Network OS R1/S1 Supabase I2 Capability Provisioning and Aggregate Templates

| Field | Value |
| --- | --- |
| Decision ID | `NOS-R1-S1-I2-CAP-01` |
| Control-plane release ID | `NOS-I2-S1-EVIDENCE-01` — independent of closed G2.3 |
| Governance version | v2.2 |
| Revision | 1 — eight governance corrections incorporated |
| Status | **FOUNDER APPROVED — corrected staged authorization; not execution-ready** |
| Founder approval date | 2026-08-22 |
| Product / release | Network OS / Release 1 / Slice 1 |
| Repository / branch | `faydog127/BHFOS` / `network-os/foundation` |
| Packet baseline | `5c52e4eb85002a3c45c30efc993c182e8134c9fe` |
| Risk tier | Tier 3 — production credential and production read capability |
| Product implementation authority | **None** |
| Release activation authority | **None** |

> This packet authorizes only the minimum protected diagnostics capability needed
> to complete the already-authorized read-only hosted-schema evidence collection.
> It does not authorize Network OS application implementation.

## 1. Founder decision recorded

The Founder directed:

> prepare and approve the **Supabase I2 Diagnostics Capability Provisioning and Slice 1 Aggregate-Template Decision Packet**

This direction approves the staged decision and boundaries in this packet. It is
not a waiver of Architecture Guard, exact-head, protected-launcher,
`FOUNDER_RUN_READY`, audit, or fail-closed requirements.

On 2026-08-22, the Founder directed that the eight identified governance
corrections be made before moving forward. Revision 1 incorporates those
corrections. G2.3 remains closed; this packet does not reopen it.

## 2. Operational problem

The Founder has already authorized read-only hosted-schema evidence collection
for the identified Slice 1 objects, limited to schema metadata, policies, grants,
dependencies, and aggregate data-quality counts. The attempt stopped before any
network access because:

1. the dedicated Supabase I2 OAuth lifecycle is not provisioned in the
   Production Diagnostics environment; and
2. the adapter does not yet provide bounded aggregate templates for the Slice 1
   objects.

The local adapter and catalog fail-closed tests pass. The hosted environment has
not been reached.

## 3. Decision

Approve a four-stage controlled diagnostics workstream. The stages may not be
collapsed or reordered.

### Stage A — repository-only capability preparation

Authorize a Builder to prepare locally, without production access:

- reconciliation of the exact OAuth scope contract;
- any fixed metadata/dependency operation missing from the existing adapter;
- local fail-closed tests, documentation, and a bounded review branch/commit;
- an independent Architecture Guard assignment for the exact head.

Stage A does not authorize push, PR creation, merge, credential creation, OAuth
consent, environment configuration, or a hosted call. Those actions retain
their separate gates in §7.

### Stage B — protected I2 provisioning and metadata collection

After Stage A is approved and merged through its exact release gate, a
Founder-authorized **human credential provisioner** may perform the unavoidable
OAuth application/consent action through the protected launcher only after
`FOUNDER_RUN_READY`. The provisioner must not disclose values to the Builder,
Architecture Guard, Production Diagnostics agent, repository, PR, or chat.

Production Diagnostics may use—but may not provision, inspect, copy, rotate, or
export—the resulting credential through the protected adapter. The capability
is limited to:

- Supabase Dashboard **Projects Read** and **Database Read** only;
- the protected OAuth helper and named HTTPS callback already governed by the
  repository;
- project ref `wwyxohjnyqnegzbxtuxs`, hard-locked by the adapter;
- the adapter's fixed read-only metadata operations;
- metadata for only the approved Slice 1 objects and directly dependent public
  relations, functions, triggers, policies, grants, and constraints;
- attributable, names-only audit records with no token or customer data.

The existing hosted-evidence authorization permits the metadata calls after the
protected identity is ready. It does not permit Dashboard table browsing or a
fallback credential. Metadata must be collected before aggregate templates are
designed.

### Stage C — metadata-derived aggregate-template implementation

Authorize a Builder to add and locally test fixed, adapter-owned aggregate
templates only after Stage B metadata identifies the exact hosted columns and
relationships. The Builder may prepare a bounded local branch/commit. Remote
push/PR creation remains separately authorized, followed by independent
Architecture Guard review. Live aggregate calls may occur only after the exact
reviewed head is approved and merged through the applicable release gate.

This is diagnostics control-plane implementation only. It is not Network OS
product implementation.

### Stage D — aggregate collection and campaign closure

After Stage C approval and merge, Production Diagnostics may run only the
approved fixed aggregate operations. It must then produce sanitized evidence,
stop the adapter/tunnel, revoke the campaign credentials, remove token material
from the external Diagnostics secret environment, and verify denial by retrying
an approved read endpoint only. No write request may be used for verification.

## 3A. Authoritative scope contract

For `NOS-I2-S1-EVIDENCE-01`, the only permitted OAuth scope strings are:

- `projects:read`;
- `database:read`.

Both are required when the token response includes a scope field. If the
platform omits the field, the protected helper must complete its existing
pre-store read-only capability attestation for both project metadata and the
bounded database-read path before storing tokens. Any additional, missing, or
ambiguous capability fails closed.

This campaign contract supersedes the older Projects-Read-only Founder steps
for this campaign. Management API permission labels such as
`project_admin_read` and `database_read` are evidence returned by the platform;
they are not substitute OAuth scope selections. Official platform terminology
must be reverified during exact-head review. A required broader scope stops the
campaign and returns a new decision.

## 4. Approved object boundary

The workstream is limited to these public Slice 1 candidate objects:

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
- `tenants`;
- directly dependent public views, functions, triggers, grants, policies,
  constraints, and indexes.

An object that does not exist must be reported as absent. The operator must not
create it or substitute another object without a new decision.

## 5. Metadata output contract

Approved metadata operations may return only:

- relation existence, kind, schema, and name;
- column name, type, nullability, and default expression;
- primary, unique, foreign-key, and check-constraint metadata;
- index names and definitions;
- RLS enabled / forced flags;
- policy names, commands, roles, and policy expressions;
- table grants for `anon`, `authenticated`, `service_role`, and `PUBLIC`;
- trigger name, timing, event, and definition;
- function name, identity arguments, volatility, and security-definer flag;
- dependency object identity and dependency type;
- migration version/name metadata when needed to explain the inspected state.

Function bodies, view row output, log bodies, Auth users, secret values, and
business-table rows are outside the contract.

Metadata expressions and definitions must be sanitized before retention.
Hard-coded UUIDs, emails, addresses, tokens, tenant/customer identifiers, or
other business literals must be redacted even when they appear inside policy,
default, index, trigger, or constraint metadata.

## 6. Aggregate output contract

Every aggregate operation must be hard-coded to an approved object and reviewed
against the verified hosted metadata. It must:

- accept no table, column, predicate, SQL, URL, project-ref, or grouping input
  from the agent;
- use the read-only database-query path only;
- return exactly one sanitized row containing numeric counts and fixed operation
  identifiers only;
- expose no primary keys, foreign-key values, names, addresses, emails, phones,
  notes, free text, JSON payloads, timestamps tied to records, or customer data;
- reject unexpected parameters and strip unexpected response fields;
- remain fail-closed when a required relation or column is absent.

### Approved count families

After exact columns are verified, fixed templates may report only the applicable
counts below:

| Count family | Permitted output |
| --- | --- |
| Presence/volume | total row count |
| Scope quality | null `tenant_id`; literal `tvg`; literal `default`; all other scope values combined |
| Required-field quality | null/blank count for an exact reviewed required field |
| Duplicate quality | duplicate-group count and total rows in duplicate groups for an exact reviewed business key |
| Relationship coverage | null-reference count and orphan-reference count for an exact reviewed foreign-key path |
| Hierarchy coverage | records lacking an expected organization/account/property parent; orphan parent count |
| Catalog reconciliation | missing stable reference; duplicate stable-reference groups/rows; catalog/price-book overlap count |
| Event/task integrity | missing actor/object/source reference; orphan reference; recognized fixed category counts plus one combined `other` count |
| Identity/scope integrity | missing or duplicate exact role/scope binding; orphan role/tenant reference count |

Free-form `GROUP BY` output is prohibited. Unknown tenant, status, source, event,
role, service, or customer values must never be returned; they may only
contribute to a single numeric `other` count.

## 7. Mandatory preconditions

### Before Stage A remote review

- [ ] Control-plane release is identified as `NOS-I2-S1-EVIDENCE-01`; G2.3 is
      not reopened.
- [ ] Corrected local decision artifacts are clean and committed.
- [ ] Founder separately authorizes the exact remote push/PR creation.
- [ ] Remote PR and exact head are identified before Architecture Guard review.

### Before Stage B provisioning or OAuth consent

- [ ] Exact execution PR/SHA has passed required checks and independent
      Architecture Guard review.
- [ ] Founder separately authorizes merge of that exact PR/SHA.
- [ ] The approved merge SHA is checked out and the worktree is clean.
- [ ] Existing protected OAuth helper, tunnel, callback, shutdown, and secret
      handling controls verified at that exact head.
- [ ] Diagnostics secret-env path exists outside the repository and chat.
- [ ] OAuth app configuration is exactly Projects Read + Database Read; no other
      scope is selected.
- [ ] Project ref is exactly `wwyxohjnyqnegzbxtuxs`.
- [ ] Readiness packet ends exactly `FOUNDER_RUN_READY`.
- [ ] No quarantined, prior-attempt, personal PAT, service-role, shared-admin, or
      unrestricted MCP credential is used.
- [ ] The human credential provisioner and campaign expiration are recorded by
      name/status only.

If any item is false, the status is `FOUNDER_RUN_BLOCKED` and execution stops.

### Before Stage C implementation

- [ ] Stage B metadata evidence is recorded without row data.
- [ ] Exact hosted relations, columns, types, and relationship paths used by
      each proposed aggregate are verified.

### Before Stage D live aggregate use

- [ ] Exact aggregate SQL templates and output keys are documented.
- [ ] Unit tests prove SELECT-only behavior, no agent SQL, no extra parameters,
      hard-coded relations/columns/predicates, and response sanitization.
- [ ] Adapter self-tests and secret scan pass.
- [ ] Independent Architecture Guard approves the exact aggregate-template head.
- [ ] Applicable exact PR/SHA merge authorization is recorded.
- [ ] Live run starts from a clean approved head and protected I2 identity.

## 8. Accepted residual-risk record

The Founder does **not** accept unrestricted token use. Supabase token-level
single-project isolation remains unproven; project isolation is enforced by the
protected adapter. This packet permits that residual risk only inside the exact
adapter, exact project-ref lock, exact read scopes, protected secret environment,
and audited launcher path. Direct token use by an agent or another client is
prohibited.

| Required field | Decision |
| --- | --- |
| Risk owner | Founder / Erron Fayson |
| Operational custodian | Human credential provisioner for setup; Production Diagnostics for adapter-only use |
| Reason | Hosted metadata is required to reconcile the legacy schema safely; Supabase token-level single-project isolation is not proven, while the hard-locked adapter provides the narrowest currently available controlled path |
| Probability | Low while the token remains confined to the protected adapter; unacceptable if exported or used by another client |
| Blast radius | Medium — read-only access could extend to other project/database metadata available to the Founder-authorized OAuth context if the token or adapter boundary is bypassed; no write scope is accepted |
| Acceptance expiry | 2026-09-30 23:59 America/New_York, or completion/revocation of the Slice 1 evidence campaign, whichever occurs first |
| Revalidation triggers | Any scope/helper/ref/callback change; exact-head change; unexpected response field; failed sanitization; missing audit attribution; token exposure; adapter bypass; authorization expiry; or any need for a broader capability |
| Decider | Founder — approval and correction direction recorded 2026-08-22 |

This is campaign-specific accepted risk, not standing I2 authority. Expiration
or any revalidation trigger returns the status to `FOUNDER_RUN_BLOCKED`.

If the protected adapter can be bypassed, emits unexpected fields, requires a
broader scope, or cannot prove callback closure and token custody, stop and
return a new decision packet.

## 9. Explicit prohibitions

This approval does not permit:

- customer-row extraction or table browsing;
- arbitrary or agent-supplied SQL;
- DDL, DML, migrations, RPC mutation, or writable query paths;
- any production negative-write request, including a write expected to fail;
- `execute-sql`;
- service-role, PAT, shared-admin, founder-personal standing access, or
  unrestricted Supabase MCP;
- Auth-user access, secrets/API-key retrieval, logs, function bodies, or storage
  objects;
- project/org listing, project-ref changes, network restrictions, or unrelated
  Supabase surfaces;
- application code, Network OS schema, product migration, deploy, merge,
  production mutation, customer communication, or Release 1 / Slice 1
  activation.

## 10. Evidence and audit requirements

The workstream must record:

- exact repository head, actor, time, project ref, and evidence classification;
- Architecture Guard verdict and exact reviewed head;
- readiness verdict without secret values;
- operation identifiers and sanitized result hashes or numeric outputs;
- explicit confirmation of zero customer-row extraction and zero mutation;
- adapter and catalog test results;
- token lifecycle state by names/status only;
- shutdown, callback-closure, and credential-revocation path status.

No raw logs, token fragments, environment dumps, authorization codes, customer
data, or SQL supplied by an agent may enter repository artifacts or chat.

Detailed metadata response bodies and exact aggregate counts must remain in
protected external Diagnostics evidence storage. Repository/PR/chat artifacts
may contain only operation identifiers, evidence classification, sanitized
findings, hashes, and counts rendered as `<5` when the exact value is below five.
Masked working evidence expires within 30 days unless a separately authorized
incident-retention rule applies. Policy/default/index/trigger/constraint text
must be scanned and literal-sensitive values redacted before retention.

The campaign's negative-capability proof consists only of local adapter denial
tests, allowlist/static route validation, read-only grants/permission metadata,
and post-revocation denial on an approved read endpoint. It must not send INSERT,
UPDATE, DELETE, DDL, mutating RPC, writable-query, or `execute-sql` requests to
production.

## 11. Stop conditions

Stop immediately if:

- `FOUNDER_RUN_READY` is unavailable or stale;
- the exact head differs from the approved head;
- a requested object/column differs from verified metadata;
- any operation would return a row identifier or business value;
- an OAuth scope is missing, broader, or ambiguous;
- the token, callback, audit, or secret-store boundary cannot be proven;
- a read-only request is rejected and the only alternative is elevated access;
- any write-capable route succeeds or appears necessary;
- the authorization reaches its expiry or campaign closure without confirmed
  revocation.

## 12. Rollback and revocation

- Stop the adapter and OAuth tunnel.
- Verify public callback closure.
- Revoke the OAuth app authorization and rotate/delete the client secret if
  issued.
- Clear access/refresh tokens and expiry metadata from the external Diagnostics
  secret environment.
- Remove the I2 OAuth application if the capability is abandoned.
- Revert an aggregate-template PR through normal Git controls if required.
- Record revocation/status by name only.

Revocation is mandatory at Stage D completion or authorization expiry, not an
optional rollback. Post-revocation verification uses an approved read endpoint
only and expects authentication denial; it never attempts a write.

## 13. Evidence already established

- Founder ratification covers product, requirements, architecture, and design
  direction only; Release 1 / Slice 1 remains inactive.
- Source-only legacy dependency inventory is complete.
- Founder authorized the bounded hosted-schema evidence collection.
- Hosted attempt stopped before network access due to absent I2 credentials.
- Local adapter and catalog fail-closed self-tests pass.
- Current adapter contains metadata templates and one unrelated hard-coded
  aggregate template; it lacks Slice 1 aggregates.
- `I2_OAUTH_DUAL_ATTEST_DECISION_PACKET.md` and current helper tests already
  establish the source-present dual-read contract; exact-head review must
  reconfirm that behavior before execution.

## 14. Exact authorization approved

> **Authorize `NOS-R1-S1-I2-CAP-01` as a staged Tier 3 diagnostics workstream:
> permit local repository preparation and testing for control-plane release
> `NOS-I2-S1-EVIDENCE-01`; require separate exact authorization for remote push,
> PR creation, and merge; after exact-head Architecture Guard approval, merge,
> and `FOUNDER_RUN_READY`, conditionally permit a Founder-authorized human
> credential provisioner to create the campaign-scoped Supabase I2 OAuth identity
> with Projects Read and Database Read only; permit Production Diagnostics to use
> but never provision or inspect that identity through the hard-locked adapter;
> require metadata collection before aggregate-template design; permit the
> already-authorized metadata and aggregate evidence collection only through
> the hard-locked read-only adapter; require campaign revocation by 2026-09-30 or
> completion, whichever occurs first; do not permit customer-row extraction,
> arbitrary SQL, DDL, DML, migrations, service-role or personal/shared-admin
> access, secrets in repo/chat, deployment, production mutation, Network OS
> implementation, merge without its applicable exact PR/SHA authorization, or
> Release 1 / Slice 1 activation.**

## 15. Immediate disposition

**APPROVED, NOT EXECUTION-READY.** No credential may be created and no live call,
push, PR, or merge may occur from this packet commit. The exact next action is a
bounded local Builder assignment for Stage A scope reconciliation and missing
metadata/dependency capability only. Remote review requires a later exact
push/PR authorization. Aggregate-template implementation waits for Stage B
metadata. Any unavoidable Founder OAuth action waits for `FOUNDER_RUN_READY`.

## 16. Correction closure register

| Correction | Resolution in Revision 1 |
| --- | --- |
| OAuth scope conflict | §3A fixes the ceiling at `projects:read` + `database:read`; current operating instructions reconciled |
| Circular execution sequence | §3 establishes non-collapsible Stages A–D; metadata precedes aggregate design |
| Incomplete accepted-risk record | §8 records owner, reason, probability, blast radius, expiry, triggers, and decider |
| Production negative-write conflict | §§9–10 prohibit any production write request and define non-mutating proof |
| Evidence handling | §§5 and 10 add sanitization, protected storage, small-count handling, and retention |
| Closed G2.3 / remote authority ambiguity | Control-plane release `NOS-I2-S1-EVIDENCE-01` is independent; §7 requires separate push/PR/merge authority |
| Provisioning-role conflict | §3 separates the human credential provisioner from adapter-only Production Diagnostics use |
| Credential lifetime | §§8 and 12 require campaign expiry, revocation, token cleanup, and read-only denial verification |
