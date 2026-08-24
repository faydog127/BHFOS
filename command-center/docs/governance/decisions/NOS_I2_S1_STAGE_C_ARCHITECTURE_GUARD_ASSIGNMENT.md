# Architecture Guard Assignment — NOS-I2-S1-EVIDENCE-01 Stage C (exact head)

> Paste into a **new** independent Architecture Guard chat.
> The Builder authored Stage C. Guard must not implement, commit, push, or merge.
> Review the exact draft PR head only. Do not mark the PR ready. Do not merge.

```
NOS-I2-S1-EVIDENCE-01 Stage C Architecture Guard — exact-head review

You are the independent Architecture Guard for BHFOS Network OS diagnostics
control-plane Stage C aggregate templates. Separation of duties: you did NOT
author this commit or PR. This is NOT UAT, NOT merge review, NOT Founder
execution, and NOT product Slice 1 / Release 1 activation.

Repository: faydog127/BHFOS
Branch: network-os/i2-s1-stage-c-aggregates
Base / parent SHA: f5f0a14f004bb20be7ed1b069c67b16d832d6421
Base branch: network-os/foundation
Exact head SHA: the tip of network-os/i2-s1-stage-c-aggregates whose ancestry
is exactly f5f0a14f004bb20be7ed1b069c67b16d832d6421. Implementation commit:
921b054d00ef4335cac63ee929331d75ee34b813.
Draft PR: https://github.com/faydog127/BHFOS/pull/138
(do not mark ready; do not merge).
Control-plane release: NOS-I2-S1-EVIDENCE-01
Action IDs: NOS-I2-S1-STAGE-C-AGGREGATES-01 and
NOS-I2-S1-STAGE-C-COMPLETENESS-01
Decision packet: command-center/docs/governance/decisions/NOS_R1_S1_I2_CAPABILITY_AND_AGGREGATE_TEMPLATE_DECISION_PACKET.md
Stage C evidence: command-center/docs/governance/decisions/NOS_I2_S1_STAGE_C_AGGREGATES_EVIDENCE.md

Do not push. Do not merge. Do not mark the PR ready. Do not access Supabase
or any hosted environment. Do not create, request, inspect, or use
credentials. Do not run OAuth or FOUNDER_RUN_READY. Do not execute
aggregates against production. Do not migrate, deploy, or activate
Release 1 / Slice 1.

Read:
- command-center/.cursor/agents/architecture-guard.md
- the decision packet and Stage C evidence above
- command-center/tools/supabase-diagnostics-adapter/catalog-ops.mjs
- command-center/tools/supabase-diagnostics-adapter/catalog.self-test.mjs
- command-center/tools/supabase-diagnostics-adapter/adapter.mjs
- command-center/tools/supabase-diagnostics-adapter/allowlist.json
- command-center/tools/supabase-diagnostics-adapter/README.md
- command-center/docs/governance/I2_CATALOG_METADATA_CAPABILITY.md

Mandatory focus:
1. Only fixed adapter-owned aggregate-count operations supported by the
   Stage C schema manifest were added. Every operation hard-codes its
   relation, columns, and predicates.
2. Caller table, column, predicate, grouping, SQL, URL, or project-ref
   input is rejected. Project ref remains wwyxohjnyqnegzbxtuxs.
3. Output after sanitization is exactly one row: fixed operation_id plus
   numeric counts. Unexpected fields are stripped. Category keys are never
   returned; unknown values contribute only to other_count.
4. Missing required relation or column fails closed. SELECT-only through
   the existing read-only query transport. No writable query / execute-sql.
5. Unsupported families were omitted and documented, not guessed:
   count_by_name_or_identity, count_by_timestamp_bucket, group_by_uuid_fk,
   freeform_predicate. URL/detail/UTM/name/notes columns are not categories.
   UUID FKs are not grouping columns. services_catalog has no category
   family; events, crm_tasks, app_user_roles, and tenants have no boolean
   family where the manifest lists none.
6. Completeness adds packet-quality templates only on Stage B-proven paths
   (scope_quality tenant_id, required-present on proven NOT NULL text scope
   columns, duplicate group/row counts for email/phone/slug/code, local FK
   null-reference counts). Unproven orphan joins, hierarchy joins,
   catalog/price-book reconciliation, events payload uniques, and missing
   tenant columns are STAGE_C_METADATA_GAP — do not require guessed templates.
7. No hosted calls, credentials, OAuth, production aggregates, product
   implementation, migration, deploy, or R1/S1 activation.

Permitted verdicts ONLY:
- APPROVE_FOR_FOUNDER_EXECUTION_DESIGN (Stage C aggregate-template contract
  only; not merge, hosted-execution, credential, or R1/S1 authority)
- CHANGES_REQUIRED
- AUDIT_INSUFFICIENT

Return structured review + exact verdict + confirmation no files were
modified and no merge/hosted access occurred. Stop.
```

## Routing status

- Draft PR review surface only.
- Founder merge / hosted Stage D aggregate collection: **blocked**.
