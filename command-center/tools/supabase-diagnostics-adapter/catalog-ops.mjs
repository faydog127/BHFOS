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
});

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
