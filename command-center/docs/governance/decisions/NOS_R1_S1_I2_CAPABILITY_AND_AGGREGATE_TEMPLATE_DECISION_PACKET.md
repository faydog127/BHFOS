# Decision Packet — Network OS R1/S1 Supabase I2 Capability Provisioning and Aggregate Templates

| Field | Value |
| --- | --- |
| Decision ID | `NOS-R1-S1-I2-CAP-01` |
| Governance version | v2.2 |
| Status | **FOUNDER APPROVED — staged authorization; execution gates remain binding** |
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

Approve a two-stage controlled diagnostics workstream.

### Stage A — protected I2 provisioning and metadata verification

Conditionally authorize Production Diagnostics to provision and use the
dedicated Supabase OAuth identity only after every precondition in §7 is true.
The capability is limited to:

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
fallback credential.

### Stage B — bounded Slice 1 aggregate-template implementation and use

Authorize a Builder to add and locally test fixed, adapter-owned aggregate
templates after Stage A metadata identifies the exact hosted columns and
relationships. The Builder may prepare a bounded PR and route it to an
independent Architecture Guard. Live aggregate calls may occur only after the
exact reviewed head is approved and merged through the applicable release gate.

This is diagnostics control-plane implementation only. It is not Network OS
product implementation.

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

### Before Stage A provisioning or OAuth consent

- [ ] Exact execution branch/head identified and clean.
- [ ] Existing protected OAuth helper, tunnel, callback, shutdown, and secret
      handling controls verified at that exact head.
- [ ] Independent Architecture Guard approves the exact execution design/head.
- [ ] Diagnostics secret-env path exists outside the repository and chat.
- [ ] OAuth app configuration is exactly Projects Read + Database Read; no other
      scope is selected.
- [ ] Project ref is exactly `wwyxohjnyqnegzbxtuxs`.
- [ ] Readiness packet ends exactly `FOUNDER_RUN_READY`.
- [ ] No quarantined, prior-attempt, personal PAT, service-role, shared-admin, or
      unrestricted MCP credential is used.

If any item is false, the status is `FOUNDER_RUN_BLOCKED` and execution stops.

### Before Stage B live aggregate use

- [ ] Stage A metadata evidence is recorded without row data.
- [ ] Exact aggregate SQL templates and output keys are documented.
- [ ] Unit tests prove SELECT-only behavior, no agent SQL, no extra parameters,
      hard-coded relations/columns/predicates, and response sanitization.
- [ ] Adapter self-tests and secret scan pass.
- [ ] Independent Architecture Guard approves the exact aggregate-template head.
- [ ] Applicable exact PR/SHA merge authorization is recorded.
- [ ] Live run starts from a clean approved head and protected I2 identity.

## 8. Residual risk treatment

The Founder does **not** accept unrestricted token use. Supabase token-level
single-project isolation remains unproven; project isolation is enforced by the
protected adapter. This packet permits that residual risk only inside the exact
adapter, exact project-ref lock, exact read scopes, protected secret environment,
and audited launcher path. Direct token use by an agent or another client is
prohibited.

If the protected adapter can be bypassed, emits unexpected fields, requires a
broader scope, or cannot prove callback closure and token custody, stop and
return a new decision packet.

## 9. Explicit prohibitions

This approval does not permit:

- customer-row extraction or table browsing;
- arbitrary or agent-supplied SQL;
- DDL, DML, migrations, RPC mutation, or writable query paths;
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

## 11. Stop conditions

Stop immediately if:

- `FOUNDER_RUN_READY` is unavailable or stale;
- the exact head differs from the approved head;
- a requested object/column differs from verified metadata;
- any operation would return a row identifier or business value;
- an OAuth scope is missing, broader, or ambiguous;
- the token, callback, audit, or secret-store boundary cannot be proven;
- a read-only request is rejected and the only alternative is elevated access;
- any write-capable route succeeds or appears necessary.

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

## 13. Evidence already established

- Founder ratification covers product, requirements, architecture, and design
  direction only; Release 1 / Slice 1 remains inactive.
- Source-only legacy dependency inventory is complete.
- Founder authorized the bounded hosted-schema evidence collection.
- Hosted attempt stopped before network access due to absent I2 credentials.
- Local adapter and catalog fail-closed self-tests pass.
- Current adapter contains metadata templates and one unrelated hard-coded
  aggregate template; it lacks Slice 1 aggregates.

## 14. Exact authorization approved

> **Authorize `NOS-R1-S1-I2-CAP-01` as a staged Tier 3 diagnostics workstream:
> permit repository preparation, local testing, independent Architecture Guard
> review, and a bounded PR for fixed Slice 1 metadata/dependency and aggregate
> templates; conditionally permit creation and protected use of the dedicated
> Supabase I2 OAuth identity with Projects Read and Database Read only after the
> exact execution head is independently approved and `FOUNDER_RUN_READY`; permit
> the already-authorized metadata and aggregate evidence collection only through
> the hard-locked read-only adapter; do not permit customer-row extraction,
> arbitrary SQL, DDL, DML, migrations, service-role or personal/shared-admin
> access, secrets in repo/chat, deployment, production mutation, Network OS
> implementation, merge without its applicable exact PR/SHA authorization, or
> Release 1 / Slice 1 activation.**

## 15. Immediate disposition

**APPROVED, NOT EXECUTION-READY.** No credential may be created and no live call
may occur from this packet commit. The exact next action is a bounded Builder
assignment for the diagnostics capability and template work, followed by
independent Architecture Guard review. Any unavoidable Founder OAuth action must
wait for `FOUNDER_RUN_READY`.

