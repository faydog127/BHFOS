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
  DEPENDENCY_METADATA_KEYS,
  APPROVED_SLICE1_RELATIONS,
  READ_ONLY_QUERY_PATH_SUFFIX,
  STAGE_C_RELATION_AGGREGATES,
  STAGE_C_OMITTED_COLUMNS,
  STAGE_C_UNSUPPORTED_FAMILIES,
  STAGE_C_AGGREGATE_OPERATION_IDS,
  STAGE_C_COUNT_ALL_KEYS,
  STAGE_C_COUNT_BY_BOOLEAN_KEYS,
  STAGE_C_COUNT_BY_CATEGORY_KEYS,
  isStageCAggregateOperation,
  stageCFamilyOf,
  stageCAggregateKeys,
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
    if (op.id === 'catalog_object_dependencies') params.table = 'organizations';
    const sql = op.buildSql(params);
    assertSqlIsSafeTemplate(sql);
  }
});

check('deny_mutation_template', () => {
  assert.throws(() => assertSqlIsSafeTemplate('DELETE FROM public.estimates'), /DENY/);
  assert.throws(() => assertSqlIsSafeTemplate('INSERT INTO public.estimates DEFAULT VALUES'), /DENY/);
  assert.throws(() => assertSqlIsSafeTemplate('UPDATE public.estimates SET id = id'), /DENY/);
  assert.throws(() => assertSqlIsSafeTemplate('SELECT 1; DROP TABLE public.estimates'), /DENY|multiple/);
  assert.throws(() => assertSqlIsSafeTemplate('TRUNCATE public.estimates'), /DENY/);
  assert.throws(() => assertSqlIsSafeTemplate('ALTER TABLE public.estimates ADD COLUMN x int'), /DENY/);
  assert.throws(() => assertSqlIsSafeTemplate('CREATE TABLE public.x (id int)'), /DENY/);
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

check('deny_unknown_dependency_operations', () => {
  assert.throws(() => resolveCatalogSql('catalog_dependencies', { schema: 'public', table: 'organizations' }), /unknown catalog/);
  assert.throws(
    () => resolveCatalogSql('catalog_object_dependencies_all', { schema: 'public', table: 'organizations' }),
    /unknown catalog/,
  );
  assert.throws(
    () => resolveCatalogSql('catalog_object_rows', { schema: 'public', table: 'organizations' }),
    /unknown catalog/,
  );
});

check('dependency_op_unexpected_params_fail', () => {
  assert.throws(
    () =>
      resolveCatalogSql('catalog_object_dependencies', {
        schema: 'public',
        table: 'organizations',
        extra: 'nope',
      }),
    /unexpected catalog param/,
  );
  assert.throws(
    () =>
      resolveCatalogSql('catalog_object_dependencies', {
        schema: 'public',
        table: 'organizations',
        sql: 'SELECT * FROM public.organizations',
      }),
    /agent-supplied SQL/,
  );
  assert.throws(
    () =>
      resolveCatalogSql('catalog_object_dependencies', {
        schema: 'public',
        table: 'organizations',
        query: 'SELECT email FROM public.contacts',
      }),
    /agent-supplied SQL/,
  );
});

check('dependency_op_non_public_schema_fails', () => {
  assert.throws(
    () => resolveCatalogSql('catalog_object_dependencies', { schema: 'auth', table: 'organizations' }),
    /not in allowlist/,
  );
  assert.throws(
    () => resolveCatalogSql('catalog_object_dependencies', { schema: 'storage', table: 'organizations' }),
    /not in allowlist/,
  );
  assert.throws(
    () => resolveCatalogSql('catalog_object_dependencies', { schema: 'pg_catalog', table: 'organizations' }),
    /not in allowlist/,
  );
});

check('dependency_op_prohibited_ident_and_injection_fail', () => {
  assert.throws(
    () => resolveCatalogSql('catalog_object_dependencies', { schema: 'public', table: 'organizations; DROP TABLE x' }),
    /DENY/,
  );
  assert.throws(
    () => resolveCatalogSql('catalog_object_dependencies', { schema: 'public', table: "organizations' OR 1=1 --" }),
    /DENY/,
  );
  assert.throws(
    () => resolveCatalogSql('catalog_object_dependencies', { schema: 'public', table: 'quotes' }),
    /not an approved public Slice 1 object/,
  );
  assert.throws(
    () => resolveCatalogSql('catalog_object_dependencies', { schema: 'public', table: 'estimates' }),
    /not an approved public Slice 1 object/,
  );
});

check('dependency_op_select_only_catalog_sources', () => {
  const { sql, params } = resolveCatalogSql('catalog_object_dependencies', {
    schema: 'public',
    table: 'organizations',
  });
  assert.deepEqual(params, { schema: 'public', table: 'organizations' });
  assertSqlIsSafeTemplate(sql);
  assert.match(sql, /^SELECT\b/i);
  assert.match(sql, /pg_catalog\.pg_depend/);
  assert.match(sql, /pg_catalog\.pg_class/);
  assert.equal(/\bFROM\s+public\./i.test(sql), false);
  assert.equal(/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/i.test(sql.replace(/'(?:''|[^'])*'/g, "''")), false);
  assert.ok(APPROVED_SLICE1_RELATIONS.includes('organizations'));
});

check('dependency_output_is_sanitized', () => {
  const sanitized = sanitizeCatalogResponseBody('catalog_object_dependencies', [
    {
      object_schema: 'public',
      object_name: 'organizations',
      dependency_type: 'table',
      tenant_id: 'leak',
      email: 'leak@example.com',
      customer_name: 'nope',
      oid: 12345,
    },
    {
      object_schema: 'auth',
      object_name: 'users',
      dependency_type: 'table',
    },
    {
      object_schema: 'public',
      object_name: 'organizations; DROP TABLE x',
      dependency_type: 'table',
    },
    {
      object_schema: 'public',
      object_name: 'accounts',
      dependency_type: 'not_a_real_type',
    },
  ]);
  assert.equal(sanitized.length, 1);
  assert.deepEqual(Object.keys(sanitized[0]).sort(), [...DEPENDENCY_METADATA_KEYS].sort());
  assert.equal(sanitized[0].dependency_identity, 'public.organizations');
  assert.equal(sanitized[0].dependency_type, 'table');
  assert.equal(sanitized[0].tenant_id, undefined);
  assert.equal(sanitized[0].email, undefined);
  assert.equal(sanitized[0].customer_name, undefined);
  assert.equal(sanitized[0].oid, undefined);
});

check('dependency_capability_cannot_return_business_rows', () => {
  const sanitized = sanitizeCatalogResponseBody('catalog_object_dependencies', [
    {
      object_schema: 'public',
      object_name: 'contacts',
      dependency_type: 'table',
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      email: 'founder@example.com',
      phone: '555-0100',
      notes: 'customer secret',
    },
  ]);
  const serialized = JSON.stringify(sanitized);
  assert.equal(sanitized[0].dependency_identity, 'public.contacts');
  assert.equal(Object.keys(sanitized[0]).length, 2);
  assert.equal(/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/.test(serialized), false);
  assert.equal(/founder@example\.com/.test(serialized), false);
  assert.equal(/555-0100/.test(serialized), false);
  assert.equal(/customer secret/.test(serialized), false);
});

await checkAsync('dry_run_dependency_op_ok', async () => {
  const out = await invokeCatalog(
    'catalog_object_dependencies',
    { schema: 'public', table: 'organizations' },
    { dryRun: true },
  );
  assert.equal(out.dry_run, true);
  assert.equal(out.operation, 'catalog_object_dependencies');
  assert.ok(out.path.endsWith(READ_ONLY_QUERY_PATH_SUFFIX));
  assert.equal(out.sql, undefined);
});

function expectedStageCOperationIds() {
  /** @type {string[]} */
  const ids = [];
  for (const relation of APPROVED_SLICE1_RELATIONS) {
    const spec = STAGE_C_RELATION_AGGREGATES[relation];
    ids.push(`catalog_${relation}_count_all`);
    for (const column of spec.booleans) {
      ids.push(`catalog_${relation}_count_by_boolean_${column}`);
    }
    for (const column of spec.categories) {
      ids.push(`catalog_${relation}_count_by_category_${column}_with_other`);
    }
  }
  return ids;
}

check('stage_c_spec_covers_only_approved_slice1_relations', () => {
  assert.deepEqual(Object.keys(STAGE_C_RELATION_AGGREGATES).sort(), [...APPROVED_SLICE1_RELATIONS].sort());
});

check('stage_c_operation_ids_match_frozen_spec', () => {
  assert.deepEqual([...STAGE_C_AGGREGATE_OPERATION_IDS].sort(), expectedStageCOperationIds().sort());
  assert.equal(STAGE_C_AGGREGATE_OPERATION_IDS.length, 69);
});

check('stage_c_ops_are_paramless_select_only_and_hardcoded', () => {
  const forbidden = [
    'source_url',
    'source_detail',
    'utm_source',
    'marketing_source_detail',
    'home_image_source',
    'email',
    'phone',
    'notes',
    'GROUP BY',
  ];
  for (const opId of STAGE_C_AGGREGATE_OPERATION_IDS) {
    const op = CATALOG_OPERATIONS[opId];
    assert.ok(op, opId);
    assert.deepEqual(op.params, []);
    const { sql, params } = resolveCatalogSql(opId, {});
    assert.deepEqual(params, {});
    assertSqlIsSafeTemplate(sql);
    assert.match(sql, /^SELECT\b/i);
    assert.match(sql, /pg_catalog\.pg_attribute/);
    const relation = Object.keys(STAGE_C_RELATION_AGGREGATES).find((rel) =>
      opId.startsWith(`catalog_${rel}_`)
    );
    assert.ok(relation, opId);
    assert.match(sql, new RegExp(`public\\."${relation}"`));
    assert.match(sql, new RegExp(`'${opId}' AS operation_id`));
    for (const token of forbidden) {
      assert.equal(sql.includes(token), false, `${opId} contains ${token}`);
    }
    assert.equal(/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/i.test(sql.replace(/'(?:''|[^'])*'/g, "''")), false);
  }
});

check('stage_c_ops_deny_caller_inputs', () => {
  const denied = {
    table: 'organizations',
    column: 'type',
    predicate: 'type = partner',
    grouping: 'type',
    sql: 'SELECT 1',
    query: 'SELECT COUNT(*) FROM public.organizations',
    url: 'https://api.supabase.com',
    ref: 'wwyxohjnyqnegzbxtuxs',
  };
  for (const [key, value] of Object.entries(denied)) {
    assert.throws(
      () => resolveCatalogSql('catalog_organizations_count_all', { [key]: value }),
      key === 'sql' || key === 'query' ? /agent-supplied SQL/ : /unexpected catalog param|agent-supplied SQL/,
    );
  }
});

check('stage_c_unsupported_families_are_unknown_ops', () => {
  for (const family of STAGE_C_UNSUPPORTED_FAMILIES) {
    assert.throws(() => resolveCatalogSql(`catalog_organizations_${family}`, {}), /unknown catalog/);
  }
  assert.throws(() => resolveCatalogSql('catalog_contacts_count_by_category_source_url_with_other', {}), /unknown catalog/);
  assert.throws(() => resolveCatalogSql('catalog_leads_count_by_category_utm_source_with_other', {}), /unknown catalog/);
  assert.throws(() => resolveCatalogSql('catalog_leads_count_by_category_source_detail_with_other', {}), /unknown catalog/);
  assert.throws(() => resolveCatalogSql('catalog_services_catalog_count_by_category_is_active_with_other', {}), /unknown catalog/);
  assert.throws(() => resolveCatalogSql('catalog_events_count_by_boolean_entity_type', {}), /unknown catalog/);
});

check('stage_c_omitted_columns_are_not_operations', () => {
  for (const [relation, columns] of Object.entries(STAGE_C_OMITTED_COLUMNS)) {
    for (const column of columns) {
      assert.equal(
        isStageCAggregateOperation(`catalog_${relation}_count_by_category_${column}_with_other`),
        false,
      );
    }
  }
});

check('stage_c_count_all_sql_uses_pk_only', () => {
  const { sql } = resolveCatalogSql('catalog_organizations_count_all', {});
  assert.match(sql, /COUNT\(t\."id"\)/);
  assert.equal(/"type"/.test(sql), false);
  assert.equal(/"is_partner"/.test(sql), false);
});

check('stage_c_boolean_sql_is_three_valued', () => {
  const { sql } = resolveCatalogSql('catalog_organizations_count_by_boolean_is_partner', {});
  assert.match(sql, /t\."is_partner" IS TRUE/);
  assert.match(sql, /t\."is_partner" IS FALSE/);
  assert.match(sql, /t\."is_partner" IS NULL/);
  assert.equal(stageCFamilyOf('catalog_organizations_count_by_boolean_is_partner'), 'count_by_boolean');
});

check('stage_c_category_sql_has_no_category_keys', () => {
  const { sql } = resolveCatalogSql('catalog_organizations_count_by_category_type_with_other', {});
  assert.match(sql, /null_or_blank_count/);
  assert.match(sql, /other_count/);
  assert.equal(/\bGROUP BY\b/i.test(sql), false);
  assert.equal(/partner|customer|vendor/i.test(sql), false);
  assert.equal(stageCFamilyOf('catalog_organizations_count_by_category_type_with_other'), 'count_by_category_with_other');
});

check('stage_c_response_sanitize_strips_and_forces_operation_id', () => {
  const sanitized = sanitizeCatalogResponseBody('catalog_contacts_count_all', [
    {
      operation_id: 'forged_id',
      row_count: 4,
      email: 'founder@example.com',
      phone: '555-0100',
      notes: 'customer secret',
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    },
  ]);
  assert.equal(sanitized.length, 1);
  assert.deepEqual(Object.keys(sanitized[0]).sort(), [...STAGE_C_COUNT_ALL_KEYS].sort());
  assert.equal(sanitized[0].operation_id, 'catalog_contacts_count_all');
  assert.equal(sanitized[0].row_count, 4);
  const serialized = JSON.stringify(sanitized);
  assert.equal(/founder@example\.com/.test(serialized), false);
  assert.equal(/555-0100/.test(serialized), false);
  assert.equal(/customer secret/.test(serialized), false);
  assert.equal(/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/.test(serialized), false);
});

check('stage_c_boolean_sanitize_keeps_numeric_counts_only', () => {
  const sanitized = sanitizeCatalogResponseBody('catalog_accounts_count_by_boolean_is_test_data', [
    {
      operation_id: 'nope',
      true_count: '2',
      false_count: 3,
      null_count: 1,
      is_test_data: true,
      name: 'leak',
    },
  ]);
  assert.deepEqual(Object.keys(sanitized[0]).sort(), [...STAGE_C_COUNT_BY_BOOLEAN_KEYS].sort());
  assert.equal(sanitized[0].operation_id, 'catalog_accounts_count_by_boolean_is_test_data');
  assert.equal(sanitized[0].true_count, 2);
  assert.equal(sanitized[0].false_count, 3);
  assert.equal(sanitized[0].null_count, 1);
  assert.equal(sanitized[0].is_test_data, undefined);
  assert.equal(sanitized[0].name, undefined);
});

check('stage_c_category_sanitize_does_not_return_category_keys', () => {
  const sanitized = sanitizeCatalogResponseBody('catalog_leads_count_by_category_status_with_other', [
    {
      operation_id: 'catalog_leads_count_by_category_status_with_other',
      null_or_blank_count: 1,
      other_count: 8,
      status: 'qualified',
      partner: 2,
    },
  ]);
  assert.deepEqual(Object.keys(sanitized[0]).sort(), [...STAGE_C_COUNT_BY_CATEGORY_KEYS].sort());
  assert.equal(sanitized[0].status, undefined);
  assert.equal(sanitized[0].partner, undefined);
  assert.equal(sanitized[0].null_or_blank_count, 1);
  assert.equal(sanitized[0].other_count, 8);
});

check('stage_c_sanitize_fail_closed_on_absent_row_or_count', () => {
  assert.throws(
    () => sanitizeCatalogResponseBody('catalog_tenants_count_all', []),
    /required relation or column may be absent/,
  );
  assert.throws(
    () => sanitizeCatalogResponseBody('catalog_tenants_count_all', [{ operation_id: 'catalog_tenants_count_all' }]),
    /missing numeric "row_count"/,
  );
  assert.throws(
    () =>
      sanitizeCatalogResponseBody('catalog_events_count_by_category_event_type_with_other', {
        error: 'relation does not exist',
      }),
    /no aggregate row/,
  );
});

check('stage_c_key_helper_matches_family', () => {
  assert.deepEqual(stageCAggregateKeys('catalog_price_book_count_all'), STAGE_C_COUNT_ALL_KEYS);
  assert.deepEqual(
    stageCAggregateKeys('catalog_price_book_count_by_boolean_taxable'),
    STAGE_C_COUNT_BY_BOOLEAN_KEYS,
  );
  assert.deepEqual(
    stageCAggregateKeys('catalog_price_book_count_by_category_item_type_with_other'),
    STAGE_C_COUNT_BY_CATEGORY_KEYS,
  );
  assert.equal(stageCAggregateKeys('catalog_object_dependencies'), null);
});

await checkAsync('dry_run_stage_c_families_ok', async () => {
  const all = await invokeCatalog('catalog_services_catalog_count_all', {}, { dryRun: true });
  assert.equal(all.dry_run, true);
  assert.equal(all.operation, 'catalog_services_catalog_count_all');
  assert.ok(all.path.endsWith(READ_ONLY_QUERY_PATH_SUFFIX));
  assert.equal(all.sql, undefined);
  const boolOp = await invokeCatalog('catalog_properties_count_by_boolean_in_ao', {}, { dryRun: true });
  assert.equal(boolOp.operation, 'catalog_properties_count_by_boolean_in_ao');
  assert.equal(boolOp.sql, undefined);
  const catOp = await invokeCatalog('catalog_app_user_roles_count_by_category_role_with_other', {}, { dryRun: true });
  assert.equal(catOp.operation, 'catalog_app_user_roles_count_by_category_role_with_other');
  assert.equal(catOp.sql, undefined);
});

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, failed: [] }));
process.exit(0);
