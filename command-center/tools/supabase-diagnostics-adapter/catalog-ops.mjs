/**
 * Bounded catalog-metadata operations for Production Diagnostics.
 *
 * Agent never supplies SQL. Only fixed templates with validated identifiers.
 * Transport: POST /v1/projects/{ref}/database/query/read-only only.
 */

export const READ_ONLY_QUERY_PATH_SUFFIX = '/database/query/read-only';

/** Allowed Postgres schema names for parameterized catalog ops. */
export const ALLOWED_SCHEMAS = Object.freeze(['public']);

/**
 * Approved public Slice 1 candidate relations for dependency-metadata only.
 * Direct dependencies may appear in sanitized output; they are not query inputs.
 */
export const APPROVED_SLICE1_RELATIONS = Object.freeze([
  'organizations',
  'accounts',
  'contacts',
  'properties',
  'leads',
  'services_catalog',
  'price_book',
  'events',
  'crm_tasks',
  'app_user_roles',
  'tenants',
]);

/** Permitted sanitized dependency-metadata output keys (identity + type only). */
export const DEPENDENCY_METADATA_KEYS = Object.freeze([
  'dependency_identity',
  'dependency_type',
]);

/** Fail-closed dependency type labels returned by catalog_object_dependencies. */
export const DEPENDENCY_TYPES = Object.freeze([
  'table',
  'partitioned_table',
  'view',
  'materialized_view',
  'index',
  'sequence',
  'relation',
  'function',
  'trigger',
  'foreign_key',
  'primary_key',
  'unique_constraint',
  'check_constraint',
  'constraint',
  'policy',
]);

/**
 * @param {string} value
 * @param {string} label
 */
export function assertSafeIdent(value, label = 'ident') {
  const v = String(value ?? '');
  if (!/^[a-z_][a-z0-9_]*$/i.test(v) || v.length > 63) {
    throw new Error(`DENY: invalid ${label} (must be SQL identifier [a-z_][a-z0-9_]{0,62})`);
  }
  return v.toLowerCase();
}

/**
 * @param {string} schema
 */
export function assertAllowedSchema(schema) {
  const s = assertSafeIdent(schema, 'schema');
  if (!ALLOWED_SCHEMAS.includes(s)) {
    throw new Error(`DENY: schema "${s}" not in allowlist (${ALLOWED_SCHEMAS.join(', ')})`);
  }
  return s;
}

/**
 * @param {string} table
 */
export function assertApprovedSlice1Relation(table) {
  const t = assertSafeIdent(table, 'table');
  if (!APPROVED_SLICE1_RELATIONS.includes(t)) {
    throw new Error(`DENY: table "${t}" is not an approved public Slice 1 object`);
  }
  return t;
}

/**
 * Reject anything that looks like agent-supplied SQL or mutation.
 * @param {unknown} maybeSql
 */
export function assertNoAgentSql(maybeSql) {
  if (maybeSql === undefined || maybeSql === null || maybeSql === '') return;
  throw new Error('DENY: agent-supplied SQL is prohibited');
}

/**
 * @typedef {{ schema?: string, table?: string, name?: string }} CatalogParams
 * @typedef {{
 *   id: string,
 *   description: string,
 *   params: string[],
 *   buildSql: (p: Record<string, string>) => string,
 *   family?: string,
 * }} CatalogOp
 */

/**
 * Stage C Slice 1 aggregate-count manifest (adapter-owned; never caller input).
 * Families are only those the sanitized STAGE_C_SCHEMA_MANIFEST can support.
 * Category values are not listed in the manifest, so non-blank values contribute
 * only to other_count. UUID FKs, names, URLs, details, UTM, notes, and
 * timestamps are not grouping or output columns.
 */
export const STAGE_C_RELATION_AGGREGATES = Object.freeze({
  organizations: Object.freeze({
    pk: 'id',
    booleans: Object.freeze(['is_partner']),
    categories: Object.freeze(['type']),
  }),
  accounts: Object.freeze({
    pk: 'id',
    booleans: Object.freeze(['is_test_data']),
    categories: Object.freeze(['type', 'partner_status']),
  }),
  contacts: Object.freeze({
    pk: 'id',
    booleans: Object.freeze([
      'marketing_opt_in',
      'is_test_data',
      'is_primary',
      'is_customer',
      'is_decision_maker',
      'is_active',
    ]),
    categories: Object.freeze([
      'role',
      'role_type',
      'source_type',
      'source_confidence',
      'contact_status',
    ]),
  }),
  properties: Object.freeze({
    pk: 'id',
    booleans: Object.freeze(['in_ao', 'is_active']),
    categories: Object.freeze([
      'source_system',
      'discovery_status',
      'target_status',
      'source_type',
      'source_confidence',
    ]),
  }),
  leads: Object.freeze({
    pk: 'id',
    booleans: Object.freeze([
      'is_partner',
      'consent_marketing',
      'needs_ai_action',
      'priority_flag',
      'is_test_data',
      'sms_consent',
      'sms_opt_out',
    ]),
    categories: Object.freeze([
      'status',
      'source',
      'pipeline_stage',
      'source_kind',
      'qualification_status',
      'lead_source',
      'job_type',
      'lane_type',
      'priority',
      'quickbooks_sync_status',
      'stage',
    ]),
  }),
  services_catalog: Object.freeze({
    pk: 'id',
    booleans: Object.freeze(['is_active']),
    categories: Object.freeze([]),
  }),
  price_book: Object.freeze({
    pk: 'id',
    booleans: Object.freeze([
      'active',
      'discount_eligible',
      'taxable',
      'online_booking_enabled',
    ]),
    categories: Object.freeze(['price_type', 'item_type', 'discount_type']),
  }),
  events: Object.freeze({
    pk: 'id',
    booleans: Object.freeze([]),
    categories: Object.freeze(['entity_type', 'event_type', 'actor_type']),
  }),
  crm_tasks: Object.freeze({
    pk: 'id',
    booleans: Object.freeze([]),
    categories: Object.freeze(['status', 'source_type', 'type', 'priority']),
  }),
  app_user_roles: Object.freeze({
    pk: 'id',
    booleans: Object.freeze([]),
    categories: Object.freeze(['role']),
  }),
  tenants: Object.freeze({
    pk: 'id',
    booleans: Object.freeze([]),
    categories: Object.freeze(['status']),
  }),
});

/** Columns present on hosted objects but rejected as category/group inputs. */
export const STAGE_C_OMITTED_COLUMNS = Object.freeze({
  contacts: Object.freeze(['source_url']),
  properties: Object.freeze(['source_url']),
  leads: Object.freeze([
    'source_detail',
    'utm_source',
    'marketing_source_detail',
    'home_image_source',
  ]),
});

/** Families the Stage C manifest cannot support without guessing or leaking values. */
export const STAGE_C_UNSUPPORTED_FAMILIES = Object.freeze([
  'count_by_name_or_identity',
  'count_by_timestamp_bucket',
  'group_by_uuid_fk',
  'freeform_predicate',
]);

/**
 * Packet-quality families proven by Stage B column/index evidence only.
 * Do not add a path that is not listed here.
 */
export const STAGE_C_SCOPE_QUALITY = Object.freeze({
  contacts: Object.freeze({ column: 'tenant_id', nullable: false }),
  leads: Object.freeze({ column: 'tenant_id', nullable: false }),
  price_book: Object.freeze({ column: 'tenant_id', nullable: true }),
  events: Object.freeze({ column: 'tenant_id', nullable: true }),
  crm_tasks: Object.freeze({ column: 'tenant_id', nullable: true }),
});

export const STAGE_C_REQUIRED_PRESENT = Object.freeze({
  contacts: Object.freeze([Object.freeze({ column: 'tenant_id', kind: 'text' })]),
  leads: Object.freeze([Object.freeze({ column: 'tenant_id', kind: 'text' })]),
});

export const STAGE_C_DUPLICATE_KEYS = Object.freeze({
  contacts: Object.freeze([Object.freeze(['email']), Object.freeze(['phone'])]),
  services_catalog: Object.freeze([Object.freeze(['slug'])]),
  price_book: Object.freeze([Object.freeze(['code']), Object.freeze(['tenant_id', 'code'])]),
});

export const STAGE_C_NULL_REFERENCE_COLUMNS = Object.freeze({
  contacts: Object.freeze([
    'organization_id',
    'account_id',
    'property_id',
    'lead_id',
    'management_company_id',
  ]),
  properties: Object.freeze(['account_id', 'management_company_id', 'zone_id', 'verified_by']),
  leads: Object.freeze([
    'account_id',
    'property_id',
    'contact_id',
    'owner_id',
    'referrer_id',
    'referring_partner_id',
  ]),
  crm_tasks: Object.freeze(['partner_id']),
  app_user_roles: Object.freeze(['user_id']),
  events: Object.freeze(['entity_id', 'actor_id']),
});

/** Unproven packet paths. Do not invent templates for these. */
export const STAGE_C_METADATA_GAPS = Object.freeze([
  Object.freeze({
    id: 'STAGE_C_METADATA_GAP',
    gap_id: 'scope_quality_no_tenant_column',
    family: 'scope_quality',
    objects: Object.freeze([
      'organizations',
      'accounts',
      'services_catalog',
      'app_user_roles',
      'tenants',
    ]),
    missing_capability:
      'Stage B proved no tenant/scope column on these relations. No alternate scope column was identified.',
  }),
  Object.freeze({
    id: 'STAGE_C_METADATA_GAP',
    gap_id: 'scope_quality_properties_unproven',
    family: 'scope_quality',
    objects: Object.freeze(['properties']),
    missing_capability:
      'Stage B did not prove a tenant/scope column on properties. Do not guess properties.tenant_id.',
  }),
  Object.freeze({
    id: 'STAGE_C_METADATA_GAP',
    gap_id: 'fk_target_paths_unproven',
    family: 'relationship_coverage.orphan_reference',
    objects: Object.freeze([...APPROVED_SLICE1_RELATIONS]),
    missing_capability:
      'catalog_constraints returned empty. Exact FK source-column → target-table.target-column paths are not proven. Orphan-reference counts that require joins are omitted.',
  }),
  Object.freeze({
    id: 'STAGE_C_METADATA_GAP',
    gap_id: 'hierarchy_join_paths_unproven',
    family: 'hierarchy_coverage',
    objects: Object.freeze(['organizations', 'accounts', 'properties', 'contacts', 'leads']),
    missing_capability:
      'Local organization/account/property FK columns exist on children, but target join paths are unproven. Joined hierarchy coverage is omitted. Numeric null/non-null on those local FK columns is implemented instead.',
  }),
  Object.freeze({
    id: 'STAGE_C_METADATA_GAP',
    gap_id: 'catalog_price_book_reconciliation_unproven',
    family: 'catalog_reconciliation',
    objects: Object.freeze(['services_catalog', 'price_book']),
    missing_capability:
      'Catalog/price-book overlap and missing stable-reference reconciliation require proven join keys. catalog_constraints did not prove those paths.',
  }),
  Object.freeze({
    id: 'STAGE_C_METADATA_GAP',
    gap_id: 'app_user_roles_tenant_binding_unproven',
    family: 'identity_scope_integrity',
    objects: Object.freeze(['app_user_roles']),
    missing_capability:
      'app_user_roles has no tenant_id. Tenant-binding and orphan role/tenant reference counts are omitted. user_id is NOT NULL; required-binding is count_all plus null_reference_user_id (expected null_count = 0).',
  }),
  Object.freeze({
    id: 'STAGE_C_METADATA_GAP',
    gap_id: 'events_payload_expression_uniques',
    family: 'duplicate_quality',
    objects: Object.freeze(['events']),
    missing_capability:
      'events unique indexes on payload JSON expressions are not typed columns. Using them would risk business literals. Payload unique duplicate counts are omitted.',
  }),
  Object.freeze({
    id: 'STAGE_C_METADATA_GAP',
    gap_id: 'required_field_nullability_incomplete',
    family: 'required_field_quality',
    objects: Object.freeze([...APPROVED_SLICE1_RELATIONS]),
    missing_capability:
      'Stage B completeness brief proved is_nullable=NO only for contacts.tenant_id, leads.tenant_id, and app_user_roles.user_id. Other required-present templates are omitted rather than guessed from unique indexes or names.',
  }),
]);

export const STAGE_C_COUNT_ALL_KEYS = Object.freeze(['operation_id', 'row_count']);
export const STAGE_C_COUNT_BY_BOOLEAN_KEYS = Object.freeze([
  'operation_id',
  'true_count',
  'false_count',
  'null_count',
]);
export const STAGE_C_COUNT_BY_CATEGORY_KEYS = Object.freeze([
  'operation_id',
  'null_or_blank_count',
  'other_count',
]);
export const STAGE_C_SCOPE_QUALITY_KEYS = Object.freeze([
  'operation_id',
  'null_count',
  'tvg_count',
  'default_count',
  'other_count',
]);
export const STAGE_C_REQUIRED_PRESENT_KEYS = Object.freeze([
  'operation_id',
  'present_count',
  'null_or_blank_count',
]);
export const STAGE_C_DUPLICATE_KEYS_OUTPUT = Object.freeze([
  'operation_id',
  'duplicate_group_count',
  'duplicate_row_count',
]);
export const STAGE_C_NULL_REFERENCE_KEYS = Object.freeze([
  'operation_id',
  'null_count',
  'non_null_count',
]);

const STAGE_C_PROHIBITED_CATEGORY_COLUMN =
  /(_url|_detail|_name)$|^(utm_|name$|notes$|email$|phone$|address$)/i;

/**
 * @param {string} value
 * @param {string} label
 */
function sqlQuotedIdent(value, label) {
  return `"${assertSafeIdent(value, label)}"`;
}

/**
 * @param {string} column
 */
function assertStageCCategoryColumn(column) {
  const c = assertSafeIdent(column, 'column');
  if (STAGE_C_PROHIBITED_CATEGORY_COLUMN.test(c)) {
    throw new Error(`DENY: column "${c}" is not a permitted Stage C category column`);
  }
  return c;
}

/**
 * @param {string} relation
 * @param {string[]} columns
 */
function buildStageCPresencePredicate(relation, columns) {
  const rel = assertSafeIdent(relation, 'table');
  const unique = [...new Set(columns.map((c) => assertSafeIdent(c, 'column')))];
  const listed = unique.map((c) => `'${c}'`).join(', ');
  return `(
  SELECT COUNT(*)::int
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = '${rel}'
    AND c.relkind IN ('r','p')
    AND a.attname IN (${listed})
    AND a.attnum > 0
    AND NOT a.attisdropped
) = ${unique.length}`;
}

/**
 * @returns {Record<string, CatalogOp>}
 */
function buildStageCCatalogOperations() {
  /** @type {Record<string, CatalogOp>} */
  const ops = {};
  const relations = Object.keys(STAGE_C_RELATION_AGGREGATES);
  if (relations.length !== APPROVED_SLICE1_RELATIONS.length) {
    throw new Error('DENY: Stage C aggregate relations must match approved Slice 1 objects');
  }
  for (const relation of APPROVED_SLICE1_RELATIONS) {
    const spec = STAGE_C_RELATION_AGGREGATES[relation];
    if (!spec) {
      throw new Error(`DENY: missing Stage C aggregate spec for "${relation}"`);
    }
    const pk = assertSafeIdent(spec.pk, 'column');
    const relSql = sqlQuotedIdent(relation, 'table');
    const pkSql = sqlQuotedIdent(pk, 'column');

    const countAllId = `catalog_${relation}_count_all`;
    const countAllCols = [pk];
    ops[countAllId] = {
      id: countAllId,
      family: 'count_all',
      description: `Stage C aggregate: total row count for public.${relation} (numeric only)`,
      params: [],
      buildSql: () => `
SELECT
  '${countAllId}' AS operation_id,
  q.row_count
FROM (
  SELECT COUNT(t.${pkSql})::bigint AS row_count
  FROM public.${relSql} t
) q
WHERE ${buildStageCPresencePredicate(relation, countAllCols)};
`.trim(),
    };

    for (const column of spec.booleans) {
      const col = assertSafeIdent(column, 'column');
      const colSql = sqlQuotedIdent(col, 'column');
      const opId = `catalog_${relation}_count_by_boolean_${col}`;
      ops[opId] = {
        id: opId,
        family: 'count_by_boolean',
        description: `Stage C aggregate: boolean counts for public.${relation}.${col} (numeric only)`,
        params: [],
        buildSql: () => `
SELECT
  '${opId}' AS operation_id,
  q.true_count,
  q.false_count,
  q.null_count
FROM (
  SELECT
    COUNT(*) FILTER (WHERE t.${colSql} IS TRUE)::bigint AS true_count,
    COUNT(*) FILTER (WHERE t.${colSql} IS FALSE)::bigint AS false_count,
    COUNT(*) FILTER (WHERE t.${colSql} IS NULL)::bigint AS null_count
  FROM public.${relSql} t
) q
WHERE ${buildStageCPresencePredicate(relation, [pk, col])};
`.trim(),
      };
    }

    for (const column of spec.categories) {
      const col = assertStageCCategoryColumn(column);
      const colSql = sqlQuotedIdent(col, 'column');
      const opId = `catalog_${relation}_count_by_category_${col}_with_other`;
      ops[opId] = {
        id: opId,
        family: 'count_by_category_with_other',
        description:
          `Stage C aggregate: null/blank plus combined other count for public.${relation}.${col} (no category keys)`,
        params: [],
        buildSql: () => `
SELECT
  '${opId}' AS operation_id,
  q.null_or_blank_count,
  q.other_count
FROM (
  SELECT
    COUNT(*) FILTER (
      WHERE t.${colSql} IS NULL OR btrim(t.${colSql}::text) = ''
    )::bigint AS null_or_blank_count,
    COUNT(*) FILTER (
      WHERE t.${colSql} IS NOT NULL AND btrim(t.${colSql}::text) <> ''
    )::bigint AS other_count
  FROM public.${relSql} t
) q
WHERE ${buildStageCPresencePredicate(relation, [pk, col])};
`.trim(),
      };
    }

    const scopeSpec = STAGE_C_SCOPE_QUALITY[relation];
    if (scopeSpec) {
      const col = assertSafeIdent(scopeSpec.column, 'column');
      const colSql = sqlQuotedIdent(col, 'column');
      const opId = `catalog_${relation}_count_scope_quality_${col}`;
      ops[opId] = {
        id: opId,
        family: 'scope_quality',
        description: `Stage C aggregate: scope-quality counts for public.${relation}.${col} (numeric only)`,
        params: [],
        buildSql: () => `
SELECT
  '${opId}' AS operation_id,
  q.null_count,
  q.tvg_count,
  q.default_count,
  q.other_count
FROM (
  SELECT
    COUNT(*) FILTER (
      WHERE t.${colSql} IS NULL OR btrim(t.${colSql}::text) = ''
    )::bigint AS null_count,
    COUNT(*) FILTER (WHERE t.${colSql} = 'tvg')::bigint AS tvg_count,
    COUNT(*) FILTER (WHERE t.${colSql} = 'default')::bigint AS default_count,
    COUNT(*) FILTER (
      WHERE t.${colSql} IS NOT NULL
        AND btrim(t.${colSql}::text) <> ''
        AND t.${colSql} NOT IN ('tvg', 'default')
    )::bigint AS other_count
  FROM public.${relSql} t
) q
WHERE ${buildStageCPresencePredicate(relation, [pk, col])};
`.trim(),
      };
    }

    for (const required of STAGE_C_REQUIRED_PRESENT[relation] || []) {
      const col = assertSafeIdent(required.column, 'column');
      const colSql = sqlQuotedIdent(col, 'column');
      const opId = `catalog_${relation}_count_required_present_${col}`;
      const presentPred =
        required.kind === 'text'
          ? `t.${colSql} IS NOT NULL AND btrim(t.${colSql}::text) <> ''`
          : `t.${colSql} IS NOT NULL`;
      const absentPred =
        required.kind === 'text'
          ? `t.${colSql} IS NULL OR btrim(t.${colSql}::text) = ''`
          : `t.${colSql} IS NULL`;
      ops[opId] = {
        id: opId,
        family: 'required_field_quality',
        description: `Stage C aggregate: required-present counts for public.${relation}.${col} (numeric only)`,
        params: [],
        buildSql: () => `
SELECT
  '${opId}' AS operation_id,
  q.present_count,
  q.null_or_blank_count
FROM (
  SELECT
    COUNT(*) FILTER (WHERE ${presentPred})::bigint AS present_count,
    COUNT(*) FILTER (WHERE ${absentPred})::bigint AS null_or_blank_count
  FROM public.${relSql} t
) q
WHERE ${buildStageCPresencePredicate(relation, [pk, col])};
`.trim(),
      };
    }

    for (const keyCols of STAGE_C_DUPLICATE_KEYS[relation] || []) {
      const cols = keyCols.map((c) => assertSafeIdent(c, 'column'));
      const colSqls = cols.map((c) => sqlQuotedIdent(c, 'column'));
      const suffix = cols.join('_');
      const opId = `catalog_${relation}_count_duplicate_${suffix}`;
      const groupList = colSqls.map((c) => `t.${c}`).join(', ');
      const populatedPred = colSqls
        .map((c) => `t.${c} IS NOT NULL AND btrim(t.${c}::text) <> ''`)
        .join(' AND ');
      ops[opId] = {
        id: opId,
        family: 'duplicate_quality',
        description: `Stage C aggregate: duplicate group/row counts for public.${relation} (${cols.join(', ')}) — no key values`,
        params: [],
        buildSql: () => `
SELECT
  '${opId}' AS operation_id,
  q.duplicate_group_count,
  q.duplicate_row_count
FROM (
  SELECT
    COUNT(*)::bigint AS duplicate_group_count,
    COALESCE(SUM(grp.cnt), 0)::bigint AS duplicate_row_count
  FROM (
    SELECT ${groupList}, COUNT(*)::bigint AS cnt
    FROM public.${relSql} t
    WHERE ${populatedPred}
    GROUP BY ${groupList}
    HAVING COUNT(*) > 1
  ) grp
) q
WHERE ${buildStageCPresencePredicate(relation, [pk, ...cols])};
`.trim(),
      };
    }

    for (const column of STAGE_C_NULL_REFERENCE_COLUMNS[relation] || []) {
      const col = assertSafeIdent(column, 'column');
      const colSql = sqlQuotedIdent(col, 'column');
      const opId = `catalog_${relation}_count_null_reference_${col}`;
      ops[opId] = {
        id: opId,
        family: 'relationship_null_reference',
        description: `Stage C aggregate: local null-reference counts for public.${relation}.${col} (numeric only; no join)`,
        params: [],
        buildSql: () => `
SELECT
  '${opId}' AS operation_id,
  q.null_count,
  q.non_null_count
FROM (
  SELECT
    COUNT(*) FILTER (WHERE t.${colSql} IS NULL)::bigint AS null_count,
    COUNT(*) FILTER (WHERE t.${colSql} IS NOT NULL)::bigint AS non_null_count
  FROM public.${relSql} t
) q
WHERE ${buildStageCPresencePredicate(relation, [pk, col])};
`.trim(),
      };
    }
  }
  return ops;
}

const STAGE_C_CATALOG_OPERATIONS = Object.freeze(buildStageCCatalogOperations());

export const STAGE_C_AGGREGATE_OPERATION_IDS = Object.freeze(
  Object.keys(STAGE_C_CATALOG_OPERATIONS)
);

/**
 * @param {string} operationId
 */
export function isStageCAggregateOperation(operationId) {
  return Object.prototype.hasOwnProperty.call(STAGE_C_CATALOG_OPERATIONS, operationId);
}

/**
 * @param {string} operationId
 */
export function stageCFamilyOf(operationId) {
  const op = STAGE_C_CATALOG_OPERATIONS[operationId];
  return op?.family ?? null;
}

/**
 * @param {string} operationId
 */
export function stageCAggregateKeys(operationId) {
  const family = stageCFamilyOf(operationId);
  if (family === 'count_all') return STAGE_C_COUNT_ALL_KEYS;
  if (family === 'count_by_boolean') return STAGE_C_COUNT_BY_BOOLEAN_KEYS;
  if (family === 'count_by_category_with_other') return STAGE_C_COUNT_BY_CATEGORY_KEYS;
  if (family === 'scope_quality') return STAGE_C_SCOPE_QUALITY_KEYS;
  if (family === 'required_field_quality') return STAGE_C_REQUIRED_PRESENT_KEYS;
  if (family === 'duplicate_quality') return STAGE_C_DUPLICATE_KEYS_OUTPUT;
  if (family === 'relationship_null_reference') return STAGE_C_NULL_REFERENCE_KEYS;
  return null;
}

/** @type {Record<string, CatalogOp>} */
export const CATALOG_OPERATIONS = Object.freeze({
  catalog_relation_exists: {
    id: 'catalog_relation_exists',
    description: 'Does the relation exist in public schema?',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = '${schema}'
    AND c.relname = '${table}'
    AND c.relkind IN ('r','p','v','m')
) AS exists;
`.trim(),
  },

  catalog_rls_flags: {
    id: 'catalog_rls_flags',
    description: 'RLS enabled and FORCE RLS flags for a table',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT c.relname AS table_name,
       n.nspname AS schema_name,
       c.relrowsecurity AS relrowsecurity,
       c.relforcerowsecurity AS relforcerowsecurity
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${schema}'
  AND c.relname = '${table}'
  AND c.relkind IN ('r','p');
`.trim(),
  },

  catalog_policies: {
    id: 'catalog_policies',
    description: 'RLS policies for a table (names, cmd, roles, permissive, exprs)',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT pol.polname AS policy_name,
       CASE pol.polcmd
         WHEN 'r' THEN 'SELECT'
         WHEN 'a' THEN 'INSERT'
         WHEN 'w' THEN 'UPDATE'
         WHEN 'd' THEN 'DELETE'
         WHEN '*' THEN 'ALL'
         ELSE pol.polcmd::text
       END AS command,
       pol.polpermissive AS permissive,
       ARRAY(
         SELECT pg_catalog.quote_ident(r.rolname)
         FROM pg_catalog.pg_roles r
         WHERE r.oid = ANY (pol.polroles)
       ) AS roles,
       pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
       pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_catalog.pg_policy pol
JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${schema}'
  AND c.relname = '${table}'
ORDER BY pol.polname;
`.trim(),
  },

  catalog_grants: {
    id: 'catalog_grants',
    description: 'Table privileges for anon, authenticated, service_role',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = '${schema}'
  AND table_name = '${table}'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY grantee, privilege_type;
`.trim(),
  },

  catalog_columns: {
    id: 'catalog_columns',
    description: 'Column names and data types (no row data)',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = '${schema}'
  AND table_name = '${table}'
ORDER BY ordinal_position;
`.trim(),
  },

  catalog_indexes: {
    id: 'catalog_indexes',
    description: 'Index definitions for a table',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT i.relname AS index_name,
       pg_catalog.pg_get_indexdef(i.oid) AS index_def
FROM pg_catalog.pg_class t
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
JOIN pg_catalog.pg_index x ON x.indrelid = t.oid
JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid
WHERE n.nspname = '${schema}'
  AND t.relname = '${table}'
ORDER BY i.relname;
`.trim(),
  },

  catalog_constraints: {
    id: 'catalog_constraints',
    description: 'Table constraints',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = '${schema}'
  AND tc.table_name = '${table}'
ORDER BY tc.constraint_type, tc.constraint_name;
`.trim(),
  },

  catalog_triggers: {
    id: 'catalog_triggers',
    description: 'Trigger names and timing for a table',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT t.tgname AS trigger_name,
       pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_def
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${schema}'
  AND c.relname = '${table}'
  AND NOT t.tgisinternal
ORDER BY t.tgname;
`.trim(),
  },

  catalog_function_signature: {
    id: 'catalog_function_signature',
    description: 'Function identity and volatility (definition optional bounded)',
    params: ['schema', 'name'],
    buildSql: ({ schema, name }) => `
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer,
       CASE p.provolatile
         WHEN 'i' THEN 'IMMUTABLE'
         WHEN 's' THEN 'STABLE'
         WHEN 'v' THEN 'VOLATILE'
       END AS volatility
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = '${schema}'
  AND p.proname = '${name}'
ORDER BY 3;
`.trim(),
  },

  catalog_migration_history: {
    id: 'catalog_migration_history',
    description: 'Supabase migration version metadata (no SQL apply)',
    params: [],
    buildSql: () => `
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
`.trim(),
  },

  /**
   * Aggregate-only precheck for ML-P1 S2 proposed
   * quotes_tenant_lead_active_unique (includes issued).
   * Hard-locked to public.quotes — no agent table/predicate params.
   * Returns conflict counts only (no tenant/lead/row payloads).
   */
  catalog_quotes_s2_active_unique_conflict_counts: {
    id: 'catalog_quotes_s2_active_unique_conflict_counts',
    description:
      'Aggregate conflict counts for proposed S2 quotes active unique (tenant_id, lead_id) including issued — no row data',
    params: [],
    buildSql: () => `
SELECT
  COUNT(*)::bigint AS conflict_group_count,
  COALESCE(SUM(grp.cnt), 0)::bigint AS conflicting_row_count
FROM (
  SELECT q.tenant_id, q.lead_id, COUNT(*)::bigint AS cnt
  FROM public.quotes q
  WHERE q.lead_id IS NOT NULL
    AND lower(coalesce(q.status, 'draft')) IN (
      'draft',
      'pending_review',
      'sent',
      'viewed',
      'issued'
    )
  GROUP BY q.tenant_id, q.lead_id
  HAVING COUNT(*) > 1
) grp;
`.trim(),
  },

  /**
   * Slice 1 I2 Stage A — fixed dependency-metadata only.
   * Returns object identity + dependency type. No definitions, no row data.
   * Query input is an approved public Slice 1 relation; output may include
   * that relation and its direct public catalog dependencies.
   */
  catalog_object_dependencies: {
    id: 'catalog_object_dependencies',
    description:
      'Direct dependency object identity and type for an approved public Slice 1 relation (no row data)',
    params: ['schema', 'table'],
    buildSql: ({ schema, table }) => `
SELECT DISTINCT
  n.nspname AS object_schema,
  cls.relname AS object_name,
  CASE cls.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned_table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    WHEN 'i' THEN 'index'
    WHEN 'S' THEN 'sequence'
    ELSE 'relation'
  END AS dependency_type
FROM pg_catalog.pg_class src
JOIN pg_catalog.pg_namespace srcn ON srcn.oid = src.relnamespace
JOIN pg_catalog.pg_depend d ON d.refobjid = src.oid OR d.objid = src.oid
JOIN pg_catalog.pg_class cls ON cls.oid = CASE
  WHEN d.refobjid = src.oid THEN d.objid
  ELSE d.refobjid
END
JOIN pg_catalog.pg_namespace n ON n.oid = cls.relnamespace
WHERE srcn.nspname = '${schema}'
  AND src.relname = '${table}'
  AND src.relkind IN ('r','p','v','m')
  AND n.nspname = 'public'
  AND cls.relname IS NOT NULL
UNION
SELECT
  n.nspname,
  p.proname,
  'function'
FROM pg_catalog.pg_class src
JOIN pg_catalog.pg_namespace srcn ON srcn.oid = src.relnamespace
JOIN pg_catalog.pg_depend d ON d.refobjid = src.oid
JOIN pg_catalog.pg_proc p ON p.oid = d.objid
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE srcn.nspname = '${schema}'
  AND src.relname = '${table}'
  AND src.relkind IN ('r','p','v','m')
  AND n.nspname = 'public'
UNION
SELECT
  srcn.nspname,
  t.tgname,
  'trigger'
FROM pg_catalog.pg_class src
JOIN pg_catalog.pg_namespace srcn ON srcn.oid = src.relnamespace
JOIN pg_catalog.pg_trigger t ON t.tgrelid = src.oid
WHERE srcn.nspname = '${schema}'
  AND src.relname = '${table}'
  AND src.relkind IN ('r','p','v','m')
  AND NOT t.tgisinternal
UNION
SELECT
  srcn.nspname,
  con.conname,
  CASE con.contype
    WHEN 'f' THEN 'foreign_key'
    WHEN 'p' THEN 'primary_key'
    WHEN 'u' THEN 'unique_constraint'
    WHEN 'c' THEN 'check_constraint'
    ELSE 'constraint'
  END
FROM pg_catalog.pg_class src
JOIN pg_catalog.pg_namespace srcn ON srcn.oid = src.relnamespace
JOIN pg_catalog.pg_constraint con ON con.conrelid = src.oid
WHERE srcn.nspname = '${schema}'
  AND src.relname = '${table}'
  AND src.relkind IN ('r','p','v','m')
UNION
SELECT
  srcn.nspname,
  pol.polname,
  'policy'
FROM pg_catalog.pg_class src
JOIN pg_catalog.pg_namespace srcn ON srcn.oid = src.relnamespace
JOIN pg_catalog.pg_policy pol ON pol.polrelid = src.oid
WHERE srcn.nspname = '${schema}'
  AND src.relname = '${table}'
  AND src.relkind IN ('r','p','v','m')
UNION
SELECT
  srcn.nspname,
  src.relname,
  CASE src.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned_table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    ELSE 'relation'
  END
FROM pg_catalog.pg_class src
JOIN pg_catalog.pg_namespace srcn ON srcn.oid = src.relnamespace
WHERE srcn.nspname = '${schema}'
  AND src.relname = '${table}'
  AND src.relkind IN ('r','p','v','m')
ORDER BY 3, 1, 2;
`.trim(),
  },

  ...STAGE_C_CATALOG_OPERATIONS,
});

/** Response keys allowed for aggregate uniqueness precheck (fail-closed strip). */
export const QUOTES_S2_ACTIVE_UNIQUE_AGGREGATE_KEYS = Object.freeze([
  'conflict_group_count',
  'conflicting_row_count',
]);

/**
 * Strip catalog response bodies that must never leak row-level business data.
 * @param {string} operationId
 * @param {unknown} body
 */
function sanitizeDependencyIdent(value) {
  const v = String(value ?? '');
  if (!/^[a-z_][a-z0-9_]*$/i.test(v) || v.length > 63) {
    return null;
  }
  return v.toLowerCase();
}

function sanitizeDependencyMetadataBody(body) {
  if (!Array.isArray(body)) {
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const row of body) {
    if (!row || typeof row !== 'object') continue;
    const schema = sanitizeDependencyIdent(row.object_schema);
    const name = sanitizeDependencyIdent(row.object_name);
    const type = sanitizeDependencyIdent(row.dependency_type);
    if (!schema || !name || !type) continue;
    if (schema !== 'public') continue;
    if (!DEPENDENCY_TYPES.includes(type)) continue;
    const identity = `${schema}.${name}`;
    const key = `${identity}\0${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      dependency_identity: identity,
      dependency_type: type,
    });
  }
  return out;
}

function coerceFiniteCount(value, operationId, key) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`DENY: catalog operation "${operationId}" missing numeric "${key}"`);
  }
  return n;
}

function sanitizeStageCAggregateBody(operationId, body) {
  const keys = stageCAggregateKeys(operationId);
  if (!keys) {
    throw new Error(`DENY: unknown Stage C aggregate "${operationId}"`);
  }
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error(
      `DENY: catalog operation "${operationId}" returned no aggregate row (required relation or column may be absent)`
    );
  }
  const row = body[0] && typeof body[0] === 'object' ? body[0] : null;
  if (!row) {
    throw new Error(`DENY: catalog operation "${operationId}" returned an invalid aggregate row`);
  }
  /** @type {Record<string, string | number>} */
  const out = { operation_id: operationId };
  for (const key of keys) {
    if (key === 'operation_id') continue;
    out[key] = coerceFiniteCount(row[key], operationId, key);
  }
  return [out];
}

export function sanitizeCatalogResponseBody(operationId, body) {
  if (operationId === 'catalog_object_dependencies') {
    return sanitizeDependencyMetadataBody(body);
  }
  if (isStageCAggregateOperation(operationId)) {
    return sanitizeStageCAggregateBody(operationId, body);
  }
  if (operationId !== 'catalog_quotes_s2_active_unique_conflict_counts') {
    return body;
  }
  if (!Array.isArray(body) || body.length === 0) {
    return [
      {
        conflict_group_count: 0,
        conflicting_row_count: 0,
      },
    ];
  }
  const row = body[0] && typeof body[0] === 'object' ? body[0] : {};
  const out = {};
  for (const key of QUOTES_S2_ACTIVE_UNIQUE_AGGREGATE_KEYS) {
    const n = Number(row[key]);
    out[key] = Number.isFinite(n) ? n : 0;
  }
  return [out];
}
/**
 * Resolve and validate a catalog operation; return fixed SQL.
 * @param {string} operationId
 * @param {Record<string, unknown>} rawParams
 * @param {{ sql?: unknown, query?: unknown }} [agentExtras] - must be empty
 */
export function resolveCatalogSql(operationId, rawParams = {}, agentExtras = {}) {
  assertNoAgentSql(agentExtras.sql);
  assertNoAgentSql(agentExtras.query);
  assertNoAgentSql(rawParams.sql);
  assertNoAgentSql(rawParams.query);

  const op = CATALOG_OPERATIONS[operationId];
  if (!op) {
    throw new Error(`DENY: unknown catalog operation "${operationId}"`);
  }

  /** @type {Record<string, string>} */
  const params = {};
  for (const key of op.params) {
    if (rawParams[key] === undefined || rawParams[key] === null || rawParams[key] === '') {
      throw new Error(`DENY: catalog operation "${operationId}" requires param "${key}"`);
    }
    if (key === 'schema') {
      params.schema = assertAllowedSchema(String(rawParams[key]));
    } else if (key === 'table' && operationId === 'catalog_object_dependencies') {
      params.table = assertApprovedSlice1Relation(String(rawParams[key]));
    } else if (key === 'table' || key === 'name') {
      params[key] = assertSafeIdent(String(rawParams[key]), key);
    } else {
      params[key] = assertSafeIdent(String(rawParams[key]), key);
    }
  }

  // Reject unexpected params (including sql)
  for (const key of Object.keys(rawParams)) {
    if (key === 'sql' || key === 'query') continue; // already denied above if set
    if (!op.params.includes(key)) {
      throw new Error(`DENY: unexpected catalog param "${key}"`);
    }
  }

  const sql = op.buildSql(params);
  assertSqlIsSafeTemplate(sql);
  return { operation: op.id, params, sql, description: op.description };
}

/**
 * Defense in depth: fixed templates must not contain mutation keywords as statements.
 * @param {string} sql
 */
export function assertSqlIsSafeTemplate(sql) {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  // Must be SELECT / WITH ... SELECT only
  if (!/^(WITH\b|SELECT\b)/i.test(normalized)) {
    throw new Error('DENY: catalog SQL templates must be SELECT-only');
  }
  // Ignore single-quoted literals (e.g. CASE … THEN 'DELETE')
  const noStrings = normalized.replace(/'(?:''|[^'])*'/g, "''");
  const banned =
    /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|COPY|EXECUTE|DO)\b/i;
  if (banned.test(noStrings)) {
    throw new Error('DENY: mutation keyword detected in catalog SQL template');
  }
  if (noStrings.includes(';')) {
    const parts = noStrings.split(';').filter((p) => p.trim());
    if (parts.length > 1) {
      throw new Error('DENY: multiple SQL statements prohibited');
    }
  }
}

/**
 * @returns {string[]}
 */
export function listCatalogOperations() {
  return Object.keys(CATALOG_OPERATIONS);
}
