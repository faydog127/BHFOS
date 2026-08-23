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
 * }} CatalogOp
 */

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

export function sanitizeCatalogResponseBody(operationId, body) {
  if (operationId === 'catalog_object_dependencies') {
    return sanitizeDependencyMetadataBody(body);
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
