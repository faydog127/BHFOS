/**
 * Network OS convention-demo policy + data-service isolation tests.
 * Run: node --test tests/unit/network-os-convention-demo.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONVENTION_READ_FAILED,
  CONVENTION_TENANT_MISMATCH,
  CONVENTION_TENANT_UNRESOLVED,
  CUSTOMER_SCOPE_IDS,
  DEMO_WRITE_ISOLATION_BLOCKED,
  assertDemoWriteAllowed,
  createConventionPolicy,
  evaluateDemoWrite,
  isIsolatedDemoTenant,
  keepDemoCustomerRows,
  resolveConventionTenant,
  sanitizeConventionError,
} from '../../src/lib/networkOs/conventionDemoPolicy.js';
import { createNetworkOsConventionService } from '../../src/services/networkOsConventionService.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function createSupabaseMock(tableResults = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const state = {
        table,
        op: 'select',
        columns: null,
        filters: [],
        payload: null,
      };
      const record = () => {
        calls.push({
          table: state.table,
          op: state.op,
          columns: state.columns,
          filters: state.filters.map((item) => [...item]),
          payload: state.payload,
        });
      };
      const resolveTable = () => {
        const keyed = tableResults[`${table}:${state.op}`];
        const value = keyed !== undefined ? keyed : tableResults[table];
        return typeof value === 'function' ? value(state) : value || { data: [], error: null };
      };
      const chain = {
        select(columns) {
          state.op = 'select';
          state.columns = columns;
          return chain;
        },
        insert(payload) {
          state.op = 'insert';
          state.payload = payload;
          record();
          return Promise.resolve(resolveTable());
        },
        update(payload) {
          state.op = 'update';
          state.payload = payload;
          return chain;
        },
        eq(col, val) {
          state.filters.push(['eq', col, val]);
          return chain;
        },
        in(col, val) {
          state.filters.push(['in', col, val]);
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        then(resolve, reject) {
          record();
          return Promise.resolve(resolveTable()).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

function hasEq(call, column, value) {
  return call.filters.some(([op, col, val]) => op === 'eq' && col === column && val === value);
}

function hasIn(call, column) {
  return call.filters.some(([op, col]) => op === 'in' && col === column);
}

const blockedPolicy = createConventionPolicy({
  isolatedDemoTenantId: '',
  rlsEffectiveProven: false,
});

describe('convention tenant resolution', () => {
  it('requires a session tenant and ignores default fallbacks', () => {
    assert.throws(
      () => resolveConventionTenant({ urlTenantId: 'tvg' }),
      (err) => err.code === CONVENTION_TENANT_UNRESOLVED,
    );
    assert.equal(resolveConventionTenant({ sessionTenantId: 'tvg' }), 'tvg');
  });

  it('denies URL/session mismatch', () => {
    assert.throws(
      () => resolveConventionTenant({ sessionTenantId: 'tvg', urlTenantId: 'other' }),
      (err) => err.code === CONVENTION_TENANT_MISMATCH,
    );
  });

  it('never treats customer scopes as isolated demo tenants', () => {
    for (const scope of CUSTOMER_SCOPE_IDS) {
      assert.equal(
        isIsolatedDemoTenant(scope, {
          isolatedDemoTenantId: scope,
          rlsEffectiveProven: true,
          customerScopeIds: CUSTOMER_SCOPE_IDS,
        }),
        false,
      );
    }
  });
});

describe('convention write isolation', () => {
  it('blocks writes without an isolated demo tenant and proven RLS', () => {
    const result = evaluateDemoWrite({ sessionTenantId: 'tvg' }, blockedPolicy);
    assert.equal(result.allowed, false);
    assert.equal(result.code, DEMO_WRITE_ISOLATION_BLOCKED);
    assert.throws(
      () => assertDemoWriteAllowed({ sessionTenantId: 'tvg' }, blockedPolicy),
      (err) => err.code === DEMO_WRITE_ISOLATION_BLOCKED,
    );
  });

  it('blocks writes when demo tenant is set but RLS is not proven', () => {
    const policy = createConventionPolicy({
      isolatedDemoTenantId: 'nos-demo',
      rlsEffectiveProven: false,
    });
    assert.throws(
      () => assertDemoWriteAllowed({ sessionTenantId: 'nos-demo' }, policy),
      (err) => err.code === DEMO_WRITE_ISOLATION_BLOCKED,
    );
  });

  it('allows writes only when isolated tenant matches and RLS is proven', () => {
    const policy = createConventionPolicy({
      isolatedDemoTenantId: 'nos-demo',
      rlsEffectiveProven: true,
    });
    assert.equal(assertDemoWriteAllowed({ sessionTenantId: 'nos-demo' }, policy), 'nos-demo');
  });
});

describe('convention customer-row filter', () => {
  it('keeps only is_test_data=true rows', () => {
    const kept = keepDemoCustomerRows([
      { id: 'cust', is_test_data: false, first_name: 'Ada' },
      { id: 'demo', is_test_data: true, first_name: 'Synth' },
      { id: 'nullish', first_name: 'Skip' },
    ]);
    assert.deepEqual(kept.map((row) => row.id), ['demo']);
  });
});

describe('convention error sanitization', () => {
  it('never forwards raw provider messages or identifiers', () => {
    const sanitized = sanitizeConventionError({
      code: '42501',
      message: 'permission denied for table leads email=ada@example.com jwt=secret',
    });
    assert.equal(sanitized.code, CONVENTION_READ_FAILED);
    assert.equal(sanitized.message, 'Unable to load convention demo data.');
    assert.equal(/example\.com|secret|jwt/i.test(sanitized.message), false);
  });
});

describe('convention data service', () => {
  it('scopes customer reads to session tenant + is_test_data and strips customer rows', async () => {
    const supabase = createSupabaseMock({
      leads: {
        data: [
          {
            id: 'lead-demo',
            tenant_id: 'tvg',
            is_test_data: true,
            first_name: 'Demo',
            last_name: 'Need',
            status: 'new',
          },
          {
            id: 'lead-customer',
            tenant_id: 'tvg',
            is_test_data: false,
            first_name: 'Customer',
            last_name: 'Row',
            status: 'new',
          },
          {
            id: 'lead-other',
            tenant_id: 'other',
            is_test_data: true,
            first_name: 'Other',
            last_name: 'Tenant',
            status: 'new',
          },
        ],
        error: null,
      },
      contacts: {
        data: [
          {
            id: 'c-demo',
            tenant_id: 'tvg',
            is_test_data: true,
            first_name: 'Pat',
            organization_id: 'org-1',
            account_id: 'acct-1',
            property_id: 'prop-1',
          },
          {
            id: 'c-customer',
            tenant_id: 'tvg',
            is_test_data: false,
            first_name: 'Real',
            organization_id: 'org-secret',
          },
        ],
        error: null,
      },
      organizations: { data: [{ id: 'org-1', type: 'property_manager', is_partner: false }], error: null },
      accounts: { data: [{ id: 'acct-1', type: 'customer', is_test_data: true }], error: null },
      properties: { data: [{ id: 'prop-1', is_active: true, in_ao: false }], error: null },
      services_catalog: { data: [{ id: 'svc-1', slug: 'inspection', is_active: true }], error: null },
      crm_tasks: {
        data: [{ id: 'task-1', tenant_id: 'tvg', status: 'open', type: 'follow_up', title: 'Call' }],
        error: null,
      },
      events: {
        data: [{ id: 'evt-1', tenant_id: 'tvg', entity_type: 'lead', event_type: 'created', actor_type: 'user' }],
        error: null,
      },
    });

    const service = createNetworkOsConventionService({ supabase, policy: blockedPolicy });
    const workspace = await service.loadWorkspace({ sessionTenantId: 'tvg' });

    assert.deepEqual(workspace.leads.rows.map((row) => row.id), ['lead-demo']);
    assert.deepEqual(workspace.contacts.rows.map((row) => row.id), ['c-demo']);
    assert.equal(workspace.leads.rows.some((row) => row.is_test_data !== true), false);
    assert.equal(workspace.write.allowed, false);
    assert.equal(workspace.write.code, DEMO_WRITE_ISOLATION_BLOCKED);

    const leadCall = supabase.calls.find((call) => call.table === 'leads' && call.op === 'select');
    const contactCall = supabase.calls.find((call) => call.table === 'contacts' && call.op === 'select');
    assert.ok(leadCall);
    assert.equal(hasEq(leadCall, 'tenant_id', 'tvg'), true);
    assert.equal(hasEq(leadCall, 'is_test_data', true), true);
    assert.equal(hasEq(contactCall, 'tenant_id', 'tvg'), true);
    assert.equal(hasEq(contactCall, 'is_test_data', true), true);

    const orgCall = supabase.calls.find((call) => call.table === 'organizations');
    const accountCall = supabase.calls.find((call) => call.table === 'accounts');
    const propertyCall = supabase.calls.find((call) => call.table === 'properties');
    assert.equal(hasIn(orgCall, 'id'), true);
    assert.equal(hasEq(accountCall, 'is_test_data', true), true);
    assert.equal(hasIn(propertyCall, 'id'), true);
    assert.equal(workspace.organizations.rows[0].id, 'org-1');
  });

  it('does not query related customer tables when demo IDs are absent', async () => {
    const supabase = createSupabaseMock({
      leads: { data: [], error: null },
      contacts: { data: [], error: null },
      services_catalog: { data: [], error: null },
    });
    const service = createNetworkOsConventionService({ supabase, policy: blockedPolicy });
    await service.loadWorkspace({ sessionTenantId: 'tvg' });
    assert.equal(supabase.calls.some((call) => call.table === 'organizations'), false);
    assert.equal(supabase.calls.some((call) => call.table === 'accounts'), false);
    assert.equal(supabase.calls.some((call) => call.table === 'properties'), false);
    assert.equal(supabase.calls.some((call) => call.table === 'crm_tasks'), false);
    assert.equal(supabase.calls.some((call) => call.table === 'events'), false);
  });

  it('never inserts when write isolation is blocked', async () => {
    const supabase = createSupabaseMock();
    const service = createNetworkOsConventionService({ supabase, policy: blockedPolicy });
    const result = await service.createDemoLead(
      { first_name: 'Nope' },
      { sessionTenantId: 'tvg' },
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, DEMO_WRITE_ISOLATION_BLOCKED);
    assert.equal(supabase.calls.some((call) => call.op === 'insert'), false);
  });

  it('inserts only after isolated tenant + proven RLS', async () => {
    const supabase = createSupabaseMock({
      'leads:insert': { data: [{ id: 'n1' }], error: null },
    });
    const policy = createConventionPolicy({
      isolatedDemoTenantId: 'nos-demo',
      rlsEffectiveProven: true,
    });
    const service = createNetworkOsConventionService({ supabase, policy });
    const result = await service.createDemoLead(
      { first_name: 'Demo', company: 'NOS' },
      { sessionTenantId: 'nos-demo' },
    );
    assert.equal(result.ok, true);
    const insert = supabase.calls.find((call) => call.op === 'insert');
    assert.ok(insert);
    assert.equal(insert.payload.tenant_id, 'nos-demo');
    assert.equal(insert.payload.is_test_data, true);
  });

  it('returns sanitized read errors without leaking provider text', async () => {
    const supabase = createSupabaseMock({
      leads: { data: null, error: { message: 'relation leads leaked email=a@b.com' } },
      contacts: { data: [], error: null },
    });
    const service = createNetworkOsConventionService({ supabase, policy: blockedPolicy });
    const workspace = await service.loadWorkspace({ sessionTenantId: 'tvg' });
    assert.equal(workspace.leads.rows.length, 0);
    assert.equal(workspace.leads.error.code, CONVENTION_READ_FAILED);
    assert.equal(/email=|a@b.com/.test(workspace.leads.error.message), false);
  });
});

describe('convention routes', () => {
  it('registers a tenant-free Network OS convention path', () => {
    const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
    assert.match(app, /path="\/network-os\/convention\/\*"/);
    assert.match(app, /NetworkOsConventionRoutes/);
    assert.doesNotMatch(app, /path="\/:tenantId\/network-os/);
  });

  it('does not add tenant-picker UX in the convention shell', () => {
    const layout = fs.readFileSync(
      path.join(root, 'src/pages/networkOs/convention/ConventionDemoLayout.jsx'),
      'utf8',
    );
    assert.doesNotMatch(layout, /select-tenant/i);
    assert.doesNotMatch(layout, /<select/);
  });
});
