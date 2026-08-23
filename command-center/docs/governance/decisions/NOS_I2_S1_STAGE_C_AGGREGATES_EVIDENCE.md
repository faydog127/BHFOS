# Stage C Evidence — NOS-I2-S1-EVIDENCE-01 Aggregate Templates

| Field | Value |
| --- | --- |
| Action ID | `NOS-I2-S1-STAGE-C-AGGREGATES-01` |
| Control-plane release | `NOS-I2-S1-EVIDENCE-01` |
| Decision packet | `NOS-R1-S1-I2-CAP-01` Revision 1 |
| Stage | C — metadata-derived aggregate-template implementation |
| Repository | `faydog127/BHFOS` |
| Branch | `network-os/i2-s1-stage-c-aggregates` |
| Base / parent SHA | `f5f0a14f004bb20be7ed1b069c67b16d832d6421` (`network-os/foundation`) |
| Implementation SHA | `921b054d00ef4335cac63ee929331d75ee34b813` |
| Draft PR | https://github.com/faydog127/BHFOS/pull/138 |
| Role | Builder (diagnostics control-plane only) |
| Evidence classification | LOCAL CONTROL-PLANE VERIFIED; NO HOSTED ACCESS |
| Product / R1 / Slice 1 activation | **None** |

This document records Stage C adapter-owned aggregate-count templates only. It
does not authorize hosted aggregate execution, credential use, OAuth, migration,
deploy, merge, product implementation, or Release 1 / Slice 1 activation.

## 1. Base confirmation

- Checked-out repository: `faydog127/BHFOS` at `/workspace`
- `origin/network-os/foundation` after fetch: `f5f0a14f004bb20be7ed1b069c67b16d832d6421`
- Worktree was clean before branch creation
- Local branch created: `network-os/i2-s1-stage-c-aggregates` from that SHA only

## 2. Investigation conclusion

Existing catalog adapter already provides:

- SELECT-only adapter-owned templates through `POST .../database/query/read-only`
- fail-closed denial of agent SQL, unexpected params, and non-public schemas
- one unrelated S2 quotes aggregate (`catalog_quotes_s2_active_unique_conflict_counts`)
- Stage A dependency-metadata (`catalog_object_dependencies`)
- project-ref lock `wwyxohjnyqnegzbxtuxs`

Stage C therefore adds new catalog operation IDs in `catalog-ops.mjs`, registers
them in the existing operation map, sanitizes responses to numeric counts plus a
fixed operation identifier, documents them in allowlist/README/governance, and
proves the contract in adapter + catalog self-tests. No new transport, no
project-ref change, no caller-supplied table/column/predicate/grouping.

The STAGE_C_SCHEMA_MANIFEST lists column names, not recognized category values.
Named category-value counts are therefore omitted: every non-blank value of a
permitted category column contributes only to `other_count`.

## 3. Applicable families

| Family | When implemented | Sanitized keys |
| --- | --- | --- |
| `count_all` | Every approved Slice 1 relation | `operation_id`, `row_count` |
| `count_by_boolean` | Relations with boolean columns in the manifest | `operation_id`, `true_count`, `false_count`, `null_count` |
| `count_by_category_with_other` | Relations with permitted text category columns | `operation_id`, `null_or_blank_count`, `other_count` |

Per-object applicability:

| Relation | count_all | count_by_boolean | count_by_category_with_other |
| --- | --- | --- | --- |
| `organizations` | yes (`id`) | `is_partner` | `type` |
| `accounts` | yes | `is_test_data` | `type`, `partner_status` |
| `contacts` | yes | `marketing_opt_in`, `is_test_data`, `is_primary`, `is_customer`, `is_decision_maker`, `is_active` | `role`, `role_type`, `source_type`, `source_confidence`, `contact_status` |
| `properties` | yes | `in_ao`, `is_active` | `source_system`, `discovery_status`, `target_status`, `source_type`, `source_confidence` |
| `leads` | yes | `is_partner`, `consent_marketing`, `needs_ai_action`, `priority_flag`, `is_test_data`, `sms_consent`, `sms_opt_out` | `status`, `source`, `pipeline_stage`, `source_kind`, `qualification_status`, `lead_source`, `job_type`, `lane_type`, `priority`, `quickbooks_sync_status`, `stage` |
| `services_catalog` | yes | `is_active` | omitted — manifest has no category family |
| `price_book` | yes | `active`, `discount_eligible`, `taxable`, `online_booking_enabled` | `price_type`, `item_type`, `discount_type` |
| `events` | yes | omitted — manifest has no boolean family | `entity_type`, `event_type`, `actor_type` |
| `crm_tasks` | yes | omitted — no boolean columns in the manifest | `status`, `source_type`, `type`, `priority` |
| `app_user_roles` | yes | omitted — no boolean columns in the manifest | `role` |
| `tenants` | yes | omitted — no boolean columns in the manifest | `status` |

## 4. Omitted families and columns (do not guess)

| Omitted | Reason |
| --- | --- |
| `count_by_name_or_identity` | Would count or group by names/identities; output would not be numeric-only |
| `count_by_timestamp_bucket` | Manifest does not authorize timestamp bucket columns; timestamps tied to records are prohibited |
| `group_by_uuid_fk` | FK identities (`account`, `lead`, `organization`, `property`, `partner`, `user`, and other UUID FKs) must not be grouped or emitted |
| `freeform_predicate` | Caller-supplied predicates are prohibited |
| Decision-packet families not in the Stage C manifest (tenant/scope quality, required-field quality, duplicate quality, relationship/hierarchy coverage, catalog reconciliation, identity/scope integrity) | Required columns/paths were not verified in the sanitized manifest; guessing is prohibited |
| Named category-value counts | Manifest lists category columns, not recognized values; unknown values go only to `other_count` |
| `contacts.source_url`, `properties.source_url` | URL columns are not category columns |
| `leads.source_detail`, `leads.utm_source`, `leads.marketing_source_detail`, `leads.home_image_source` | Detail/UTM/source-url-like columns are not category columns |
| Names, notes, emails, phones, JSON, addresses | Prohibited output / grouping |

## 5. Operation IDs (69)

### organizations

- `catalog_organizations_count_all`
- `catalog_organizations_count_by_boolean_is_partner`
- `catalog_organizations_count_by_category_type_with_other`

### accounts

- `catalog_accounts_count_all`
- `catalog_accounts_count_by_boolean_is_test_data`
- `catalog_accounts_count_by_category_type_with_other`
- `catalog_accounts_count_by_category_partner_status_with_other`

### contacts

- `catalog_contacts_count_all`
- `catalog_contacts_count_by_boolean_marketing_opt_in`
- `catalog_contacts_count_by_boolean_is_test_data`
- `catalog_contacts_count_by_boolean_is_primary`
- `catalog_contacts_count_by_boolean_is_customer`
- `catalog_contacts_count_by_boolean_is_decision_maker`
- `catalog_contacts_count_by_boolean_is_active`
- `catalog_contacts_count_by_category_role_with_other`
- `catalog_contacts_count_by_category_role_type_with_other`
- `catalog_contacts_count_by_category_source_type_with_other`
- `catalog_contacts_count_by_category_source_confidence_with_other`
- `catalog_contacts_count_by_category_contact_status_with_other`

### properties

- `catalog_properties_count_all`
- `catalog_properties_count_by_boolean_in_ao`
- `catalog_properties_count_by_boolean_is_active`
- `catalog_properties_count_by_category_source_system_with_other`
- `catalog_properties_count_by_category_discovery_status_with_other`
- `catalog_properties_count_by_category_target_status_with_other`
- `catalog_properties_count_by_category_source_type_with_other`
- `catalog_properties_count_by_category_source_confidence_with_other`

### leads

- `catalog_leads_count_all`
- `catalog_leads_count_by_boolean_is_partner`
- `catalog_leads_count_by_boolean_consent_marketing`
- `catalog_leads_count_by_boolean_needs_ai_action`
- `catalog_leads_count_by_boolean_priority_flag`
- `catalog_leads_count_by_boolean_is_test_data`
- `catalog_leads_count_by_boolean_sms_consent`
- `catalog_leads_count_by_boolean_sms_opt_out`
- `catalog_leads_count_by_category_status_with_other`
- `catalog_leads_count_by_category_source_with_other`
- `catalog_leads_count_by_category_pipeline_stage_with_other`
- `catalog_leads_count_by_category_source_kind_with_other`
- `catalog_leads_count_by_category_qualification_status_with_other`
- `catalog_leads_count_by_category_lead_source_with_other`
- `catalog_leads_count_by_category_job_type_with_other`
- `catalog_leads_count_by_category_lane_type_with_other`
- `catalog_leads_count_by_category_priority_with_other`
- `catalog_leads_count_by_category_quickbooks_sync_status_with_other`
- `catalog_leads_count_by_category_stage_with_other`

### services_catalog

- `catalog_services_catalog_count_all`
- `catalog_services_catalog_count_by_boolean_is_active`

### price_book

- `catalog_price_book_count_all`
- `catalog_price_book_count_by_boolean_active`
- `catalog_price_book_count_by_boolean_discount_eligible`
- `catalog_price_book_count_by_boolean_taxable`
- `catalog_price_book_count_by_boolean_online_booking_enabled`
- `catalog_price_book_count_by_category_price_type_with_other`
- `catalog_price_book_count_by_category_item_type_with_other`
- `catalog_price_book_count_by_category_discount_type_with_other`

### events

- `catalog_events_count_all`
- `catalog_events_count_by_category_entity_type_with_other`
- `catalog_events_count_by_category_event_type_with_other`
- `catalog_events_count_by_category_actor_type_with_other`

### crm_tasks

- `catalog_crm_tasks_count_all`
- `catalog_crm_tasks_count_by_category_status_with_other`
- `catalog_crm_tasks_count_by_category_source_type_with_other`
- `catalog_crm_tasks_count_by_category_type_with_other`
- `catalog_crm_tasks_count_by_category_priority_with_other`

### app_user_roles

- `catalog_app_user_roles_count_all`
- `catalog_app_user_roles_count_by_category_role_with_other`

### tenants

- `catalog_tenants_count_all`
- `catalog_tenants_count_by_category_status_with_other`

## 6. Fail-closed contract

- Every operation hard-codes `public.<relation>` and the exact columns.
- `resolveCatalogSql` accepts no params; table/column/predicate/grouping/SQL/URL/project-ref → DENY.
- SQL is SELECT-only through the existing read-only query transport.
- Presence of the required relation/columns is asserted via `pg_catalog`. Absence yields a database error or zero outer rows; sanitizer then DENY rather than inventing zeros.
- Sanitizer forces `operation_id` from the requested operation, keeps only the family numeric keys, and strips unexpected fields.
- Project-ref lock remains `wwyxohjnyqnegzbxtuxs`.

## 7. Files changed

- `command-center/tools/supabase-diagnostics-adapter/catalog-ops.mjs`
- `command-center/tools/supabase-diagnostics-adapter/catalog.self-test.mjs`
- `command-center/tools/supabase-diagnostics-adapter/adapter.mjs`
- `command-center/tools/supabase-diagnostics-adapter/allowlist.json`
- `command-center/tools/supabase-diagnostics-adapter/README.md`
- `command-center/docs/governance/I2_CATALOG_METADATA_CAPABILITY.md`
- `command-center/docs/governance/decisions/NOS_I2_S1_STAGE_C_AGGREGATES_EVIDENCE.md`
- `command-center/docs/governance/decisions/NOS_I2_S1_STAGE_C_ARCHITECTURE_GUARD_ASSIGNMENT.md`

## 8. Tests executed

```text
node command-center/tools/supabase-diagnostics-adapter/cli.mjs --self-test
node command-center/tools/supabase-diagnostics-adapter/catalog.self-test.mjs
node command-center/tools/supabase-diagnostics-adapter/oauth-authorize.mjs --self-test
node command-center/tools/supabase-diagnostics-adapter/oauth-tunnel.self-test.mjs
node command-center/tools/supabase-diagnostics-adapter/oauth-launcher-preflight.self-test.mjs
node command-center/tools/founder-run-readiness.mjs --self-test
git diff --check
```

Results (locally verified; no hosted calls):

- `cli.mjs --self-test`: PASS (`ok: true`, `failed: []`; catalog ops registered = 81)
- `catalog.self-test.mjs`: PASS (`ok: true`, `failed: []`)
- `oauth-authorize.mjs --self-test`: PASS (`ok: true`)
- `oauth-tunnel.self-test.mjs`: PASS (`ok: true`, `failed: []`)
- `oauth-launcher-preflight.self-test.mjs`: PASS (`ok: true`, `failed: []`)
- `founder-run-readiness.mjs --self-test`: PASS
- `git diff --check`: PASS (no whitespace errors)

## 9. Explicit non-actions

- no credential created, requested, inspected, or used
- no hosted Supabase / Cloudflare / production call
- no OAuth authorize / consent / `FOUNDER_RUN_READY`
- no aggregate executed against production
- no Network OS product feature implemented
- no DDL, DML, migration, deploy, or environment mutation
- no agent-provided SQL accepted
- no customer row extracted
- no merge and no ready-for-review mark by this Builder
- Release 1 / Slice 1 not activated
