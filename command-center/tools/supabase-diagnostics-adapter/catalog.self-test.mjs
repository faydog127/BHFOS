/**
 * Extra catalog negative proofs (also covered in adapter --self-test).
 */
import assert from 'node:assert/strict';
import {
  resolveCatalogSql,
  assertSqlIsSafeTemplate,
  CATALOG_OPERATIONS,
  sanitizeCatalogResponseBody,
  QUOTES_S2_ACTIVE_UNIQUE_AGGREGATE_KEYS,
  READ_ONLY_QUERY_PATH_SUFFIX,
} from './catalog-ops.mjs';
import { invokeCatalog, assertNotProhibited, PRODUCTION_PROJECT_REF } from './adapter.mjs';

const failures = [];

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failures.push({ name, error: String(e.message || e) });
    console.error(`FAIL ${name}: ${e.message || e}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failures.push({ name, error: String(e.message || e) });
    console.error(`FAIL ${name}: ${e.message || e}`);
  }
}

check('templates_are_select_only', () => {
  for (const op of Object.values(CATALOG_OPERATIONS)) {
    const params = {};
    for (const p of op.params) {
      params[p] = p === 'schema' ? 'public' : 'estimates';
    }
    if (op.params.includes('name')) params.name = 'generate_estimate_number';
    const sql = op.buildSql(params);
    assertSqlIsSafeTemplate(sql);
  }
});

check('deny_mutation_template', () => {
  assert.throws(() => assertSqlIsSafeTemplate('DELETE FROM public.estimates'), /DENY/);
  assert.throws(() => assertSqlIsSafeTemplate('INSERT INTO public.estimates DEFAULT VALUES'), /DENY/);
  assert.throws(() => assertSqlIsSafeTemplate('SELECT 1; DROP TABLE public.estimates'), /DENY|multiple/);
});

check('deny_agent_sql', () => {
  assert.throws(
    () => resolveCatalogSql('catalog_columns', { schema: 'public', table: 'estimates', sql: 'SELECT 1' }),
    /agent-supplied SQL/,
  );
});

check('deny_non_public_schema', () => {
  assert.throws(
    () => resolveCatalogSql('catalog_columns', { schema: 'auth', table: 'users' }),
    /not in allowlist/,
  );
});

check('s2_active_unique_op_hardcoded_predicate', () => {
  const { sql, params } = resolveCatalogSql('catalog_quotes_s2_active_unique_conflict_counts', {});
  assert.deepEqual(params, {});
  assert.match(sql, /public\.quotes/);
  assert.match(sql, /'issued'/);
  assert.match(sql, /conflict_group_count/);
  assert.match(sql, /conflicting_row_count/);
  assert.match(sql, /HAVING COUNT\(\*\) > 1/);
  const outer = sql.slice(0, sql.indexOf('FROM ('));
  assert.equal(/\btenant_id\b/.test(outer), false);
  assert.equal(/\blead_id\b/.test(outer), false);
  assert.equal(/\bcustomer_/i.test(sql), false);
  assert.equal(/\bpublic_token\b/i.test(sql), false);
  assert.equal(/\bservice_address\b/i.test(sql), false);
});

check('s2_active_unique_deny_extra_params', () => {
  assert.throws(
    () =>
      resolveCatalogSql('catalog_quotes_s2_active_unique_conflict_counts', {
        table: 'quotes',
      }),
    /unexpected catalog param/,
  );
  assert.throws(
    () =>
      resolveCatalogSql('catalog_quotes_s2_active_unique_conflict_counts', {
        sql: 'SELECT tenant_id FROM public.quotes',
      }),
    /agent-supplied SQL/,
  );
});

check('s2_active_unique_response_sanitize_strips_row_fields', () => {
  const sanitized = sanitizeCatalogResponseBody('catalog_quotes_s2_active_unique_conflict_counts', [
    {
      conflict_group_count: 2,
      conflicting_row_count: 5,
      tenant_id: 'leak',
      lead_id: 'leak2',
      customer_name: 'nope',
    },
  ]);
  assert.deepEqual(Object.keys(sanitized[0]).sort(), [...QUOTES_S2_ACTIVE_UNIQUE_AGGREGATE_KEYS].sort());
  assert.equal(sanitized[0].conflict_group_count, 2);
  assert.equal(sanitized[0].conflicting_row_count, 5);
  assert.equal(sanitized[0].tenant_id, undefined);
});

await checkAsync('deny_writable_query_path', async () => {
  assert.throws(
    () => assertNotProhibited(`/v1/projects/${PRODUCTION_PROJECT_REF}/database/query`),
    /DENY/,
  );
});

await checkAsync('deny_readonly_without_flag', async () => {
  assert.throws(
    () =>
      assertNotProhibited(`/v1/projects/${PRODUCTION_PROJECT_REF}${READ_ONLY_QUERY_PATH_SUFFIX}`),
    /DENY/,
  );
});

await checkAsync('dry_run_catalog_ok', async () => {
  const out = await invokeCatalog(
    'catalog_relation_exists',
    { schema: 'public', table: 'estimates' },
    { dryRun: true },
  );
  assert.equal(out.dry_run, true);
  assert.equal(out.method, 'POST');
  assert.ok(out.path.endsWith(READ_ONLY_QUERY_PATH_SUFFIX));
  assert.equal(out.sql, undefined);
});

await checkAsync('dry_run_s2_active_unique_ok', async () => {
  const out = await invokeCatalog('catalog_quotes_s2_active_unique_conflict_counts', {}, { dryRun: true });
  assert.equal(out.dry_run, true);
  assert.equal(out.operation, 'catalog_quotes_s2_active_unique_conflict_counts');
  assert.ok(out.path.endsWith(READ_ONLY_QUERY_PATH_SUFFIX));
  assert.equal(out.sql, undefined);
});

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, failed: [] }));
process.exit(0);
