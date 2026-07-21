/**
 * Extra catalog negative proofs (also covered in adapter --self-test).
 */
import assert from 'node:assert/strict';
import {
  resolveCatalogSql,
  assertSqlIsSafeTemplate,
  CATALOG_OPERATIONS,
} from './catalog-ops.mjs';
import { invokeCatalog, assertNotProhibited, PRODUCTION_PROJECT_REF } from './adapter.mjs';
import { READ_ONLY_QUERY_PATH_SUFFIX } from './catalog-ops.mjs';

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
    /agent-supplied SQL/
  );
});

check('deny_non_public_schema', () => {
  assert.throws(
    () => resolveCatalogSql('catalog_columns', { schema: 'auth', table: 'users' }),
    /not in allowlist/
  );
});

await checkAsync('deny_writable_query_path', async () => {
  assert.throws(
    () => assertNotProhibited(`/v1/projects/${PRODUCTION_PROJECT_REF}/database/query`),
    /DENY/
  );
});

await checkAsync('deny_readonly_without_flag', async () => {
  assert.throws(
    () =>
      assertNotProhibited(
        `/v1/projects/${PRODUCTION_PROJECT_REF}${READ_ONLY_QUERY_PATH_SUFFIX}`
      ),
    /DENY/
  );
});

await checkAsync('dry_run_catalog_ok', async () => {
  const out = await invokeCatalog(
    'catalog_relation_exists',
    { schema: 'public', table: 'estimates' },
    { dryRun: true }
  );
  assert.equal(out.dry_run, true);
  assert.equal(out.method, 'POST');
  assert.ok(out.path.endsWith(READ_ONLY_QUERY_PATH_SUFFIX));
  assert.equal(out.sql, undefined);
});

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, failed: [] }));
process.exit(0);
