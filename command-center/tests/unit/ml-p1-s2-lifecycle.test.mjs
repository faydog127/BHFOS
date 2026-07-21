/**
 * ML-P1 Slice 2 — lifecycle + R-S1-03 role authz + adversarial cases.
 * Run: node --test tests/unit/ml-p1-s2-lifecycle.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ML_P1_S2_CAPABILITIES,
  ROLE_AUTHZ_DENY_CODE,
  assertCapability,
  canPerform,
  isRoleAuthzDeniedError,
  normalizeActorRole,
} from '../../src/lib/mlP1S2RoleAuthz.js';
import { denyEstimatesCreate, assertEstimatesCreateAllowed } from '../../src/lib/mlP1S1EstimatesDeny.js';
import { TENANT_DENY_CODE } from '../../src/lib/mlP1S1Tenant.js';
import {
  ML_P1_S2_STATUSES,
  assertQuoteMutableForEdit,
  assertTransitionAllowed,
  createMlP1S2QuoteLifecycleService,
  normalizeQuoteStatus,
} from '../../src/services/mlP1S2QuoteLifecycleService.js';
import { ML_P1_S2_EVENT_TYPES, buildS2AuditEvent } from '../../src/lib/mlP1S2AuditEvents.js';
import { assertAuditPayloadComplete } from '../../src/lib/mlP1S1AuditEvents.js';

function makeQuoteStore(seed) {
  const quotes = new Map(seed.map((q) => [q.id, { ...q }]));
  const items = new Map();
  const events = [];
  let insertCount = 0;

  const supabase = {
    from(table) {
      const state = {
        table,
        filters: {},
        op: null,
        payload: null,
        selectCols: '*',
      };
      const api = {
        select(cols) {
          state.selectCols = cols;
          return api;
        },
        insert(rows) {
          state.op = 'insert';
          state.payload = rows;
          return api;
        },
        update(patch) {
          state.op = 'update';
          state.payload = patch;
          return api;
        },
        delete() {
          state.op = 'delete';
          return api;
        },
        eq(col, val) {
          state.filters[col] = val;
          return api;
        },
        maybeSingle: async () => {
          if (table !== 'quotes') return { data: null, error: null };
          for (const q of quotes.values()) {
            let ok = true;
            for (const [k, v] of Object.entries(state.filters)) {
              if (q[k] !== v) ok = false;
            }
            if (ok) return { data: { ...q }, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (table === 'events') {
            events.push(state.payload);
            return { data: state.payload, error: null };
          }
          if (table === 'quote_items') {
            if (state.op === 'insert') {
              const list = items.get(state.payload[0]?.quote_id) || [];
              list.push(...state.payload);
              items.set(state.payload[0].quote_id, list);
              return { data: state.payload, error: null };
            }
            const qid = state.filters.quote_id;
            return { data: items.get(qid) || [], error: null };
          }
          if (table === 'quotes') {
            if (state.op === 'insert') {
              insertCount += 1;
              const row = {
                ...state.payload[0],
                id: state.payload[0].id || `q-new-${insertCount}`,
              };
              quotes.set(row.id, row);
              return { data: { ...row }, error: null };
            }
            if (state.op === 'update') {
              const id = state.filters.id;
              const existing = quotes.get(id);
              if (!existing) return { data: null, error: { message: 'not found' } };
              if (state.filters.tenant_id && existing.tenant_id !== state.filters.tenant_id) {
                return { data: null, error: { message: 'tenant mismatch' } };
              }
              const next = { ...existing, ...state.payload };
              // Simulate DB normalize approved → accepted
              if (String(next.status).toLowerCase() === 'approved') {
                next.status = 'accepted';
              }
              quotes.set(id, next);
              return { data: { ...next }, error: null };
            }
          }
          return { data: null, error: { message: 'unsupported' } };
        },
        then(resolve, reject) {
          // await supabase.from('quote_items').select(...).eq(...)
          if (table === 'quote_items' && state.op !== 'insert') {
            const qid = state.filters.quote_id;
            return Promise.resolve({ data: items.get(qid) || [], error: null }).then(
              resolve,
              reject,
            );
          }
          if (table === 'events' && state.op === 'insert') {
            events.push(state.payload);
            return Promise.resolve({ data: state.payload, error: null }).then(resolve, reject);
          }
          if (table === 'quotes' && state.op === 'update') {
            const id = state.filters.id;
            const existing = quotes.get(id);
            if (!existing) {
              return Promise.resolve({ data: null, error: { message: 'not found' } }).then(
                resolve,
                reject,
              );
            }
            const next = { ...existing, ...state.payload };
            if (String(next.status).toLowerCase() === 'approved') {
              next.status = 'accepted';
            }
            quotes.set(id, next);
            return Promise.resolve({ data: { ...next }, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      return api;
    },
    _quotes: quotes,
    _events: events,
    _insertCount: () => insertCount,
  };
  return supabase;
}

describe('ML-P1 S2 R-S1-03 role matrix', () => {
  it('maps live roles and denies viewer/partner/technician money mutations', () => {
    assert.equal(normalizeActorRole('csr'), 'office');
    assert.equal(normalizeActorRole('viewer'), 'unauthenticated');
    assert.equal(canPerform(ML_P1_S2_CAPABILITIES.ISSUE, 'office'), true);
    assert.equal(canPerform(ML_P1_S2_CAPABILITIES.ISSUE, 'technician'), false);
    assert.equal(canPerform(ML_P1_S2_CAPABILITIES.ISSUE, 'viewer'), false);
    assert.equal(canPerform(ML_P1_S2_CAPABILITIES.APPROVE_CUSTOMER, 'customer'), true);
    assert.equal(canPerform(ML_P1_S2_CAPABILITIES.APPROVE_CUSTOMER, 'office'), false);
    assert.equal(canPerform(ML_P1_S2_CAPABILITIES.APPROVE_BREAK_GLASS, 'admin'), true);
  });

  it('DENY unauthorized role and unauthenticated (S-05)', () => {
    assert.throws(
      () => assertCapability(ML_P1_S2_CAPABILITIES.ISSUE, 'technician'),
      (err) => isRoleAuthzDeniedError(err) && err.code === ROLE_AUTHZ_DENY_CODE,
    );
    assert.throws(
      () => assertCapability(ML_P1_S2_CAPABILITIES.ISSUE, null),
      (err) => isRoleAuthzDeniedError(err),
    );
    assert.throws(
      () => assertCapability(ML_P1_S2_CAPABILITIES.APPROVE_BREAK_GLASS, 'admin'),
      (err) => err.code === 'ML_P1_S2_BREAK_GLASS_REASON_REQUIRED',
    );
  });
});

describe('ML-P1 S2 transitions + immutability', () => {
  it('allows Money-State happy path transitions only', () => {
    assertTransitionAllowed('issue', 'draft');
    assertTransitionAllowed('approve', 'issued');
    assertTransitionAllowed('reject', 'issued');
    assertTransitionAllowed('expire', 'issued');
    assertTransitionAllowed('revise', 'issued');
    assert.throws(() => assertTransitionAllowed('approve', 'draft'), (e) => e.code === 'ML_P1_S2_TRANSITION_DENY');
    assert.throws(() => assertTransitionAllowed('issue', 'issued'), (e) => e.code === 'ML_P1_S2_TRANSITION_DENY');
  });

  it('blocks in-place edit of issued/approved content', () => {
    assert.throws(() => assertQuoteMutableForEdit('issued'), (e) => e.code === 'ML_P1_S2_IMMUTABLE');
    assert.throws(() => assertQuoteMutableForEdit('accepted'), (e) => e.code === 'ML_P1_S2_IMMUTABLE');
    assert.equal(assertQuoteMutableForEdit('draft'), true);
  });

  it('normalizes approved → accepted for comparison', () => {
    assert.equal(normalizeQuoteStatus('approved'), 'accepted');
  });
});

describe('ML-P1 S2 audit G-02 fields', () => {
  it('builds complete issued/approved audit payloads', () => {
    const row = buildS2AuditEvent({
      tenantId: 'tvg',
      recordId: 'q1',
      actorId: 'u1',
      actorRole: 'office',
      previousState: 'draft',
      newState: 'issued',
      sourceAction: 'ml_p1_s2.issue_quote',
      correlationId: 'c1',
      eventType: ML_P1_S2_EVENT_TYPES.ISSUED,
      related: { lead_id: 'l1' },
    });
    assert.equal(row.event_type, ML_P1_S2_EVENT_TYPES.ISSUED);
    assert.equal(assertAuditPayloadComplete(row.payload).ok, true);
  });
});

describe('ML-P1 S2 lifecycle service (happy + adversarial)', () => {
  it('issues draft → issued with audit and no job create claim', async () => {
    const supabase = makeQuoteStore([
      {
        id: 'q1',
        tenant_id: 'tvg',
        lead_id: 'l1',
        status: 'draft',
        total_amount: 100,
        quote_version: 1,
      },
    ]);
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    const result = await svc.issueQuote({
      quoteId: 'q1',
      sessionTenantId: 'tvg',
      urlTenantId: 'tvg',
      actorId: 'u-office',
      actorRole: 'csr',
    });
    assert.equal(result.quote.status, 'issued');
    assert.equal(result.jobCreated, false);
    assert.ok(result.audit.ok);
    assert.equal(supabase._quotes.get('q1').status, 'issued');
  });

  it('customer approve issued → accepted (normalized) without job', async () => {
    const supabase = makeQuoteStore([
      {
        id: 'q2',
        tenant_id: 'tvg',
        lead_id: 'l1',
        status: 'issued',
        total_amount: 250,
        quote_version: 1,
      },
    ]);
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    const result = await svc.approveQuote({
      quoteId: 'q2',
      sessionTenantId: 'tvg',
      urlTenantId: 'tvg',
      actorId: 'cust-1',
      actorRole: 'customer',
      approvalMethod: 'public_token',
    });
    assert.equal(result.quote.status, 'accepted');
    assert.equal(result.quote.approved_amount, 250);
    assert.equal(result.jobCreated, false);
  });

  it('admin break-glass approve requires reason_code', async () => {
    const supabase = makeQuoteStore([
      { id: 'q3', tenant_id: 'tvg', lead_id: 'l1', status: 'issued', total_amount: 10 },
    ]);
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    await assert.rejects(
      () =>
        svc.approveQuote({
          quoteId: 'q3',
          sessionTenantId: 'tvg',
          urlTenantId: 'tvg',
          actorId: 'admin-1',
          actorRole: 'admin',
        }),
      (err) => err.code === 'ML_P1_S2_BREAK_GLASS_REASON_REQUIRED',
    );
  });

  it('DENY technician issue (unauthorized role)', async () => {
    const supabase = makeQuoteStore([
      { id: 'q4', tenant_id: 'tvg', lead_id: 'l1', status: 'draft', total_amount: 10 },
    ]);
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    await assert.rejects(
      () =>
        svc.issueQuote({
          quoteId: 'q4',
          sessionTenantId: 'tvg',
          urlTenantId: 'tvg',
          actorId: 'tech-1',
          actorRole: 'technician',
        }),
      (err) => err.code === ROLE_AUTHZ_DENY_CODE,
    );
  });

  it('DENY missing session tenant (TVG context)', async () => {
    const supabase = makeQuoteStore([
      { id: 'q5', tenant_id: 'tvg', lead_id: 'l1', status: 'draft', total_amount: 10 },
    ]);
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    await assert.rejects(
      () =>
        svc.issueQuote({
          quoteId: 'q5',
          urlTenantId: 'tvg',
          actorId: 'u1',
          actorRole: 'office',
        }),
      (err) => err.code === TENANT_DENY_CODE,
    );
  });

  it('reject + expire + revise create new draft version', async () => {
    const supabase = makeQuoteStore([
      {
        id: 'q6',
        tenant_id: 'tvg',
        lead_id: 'l1',
        status: 'issued',
        total_amount: 99,
        quote_version: 1,
        service_address: '1 Main',
        customer_name: 'A',
      },
    ]);
    const svc = createMlP1S2QuoteLifecycleService({ supabase });

    const rejected = await svc.rejectQuote({
      quoteId: 'q6',
      sessionTenantId: 'tvg',
      urlTenantId: 'tvg',
      actorId: 'u1',
      actorRole: 'manager',
      rejectionReason: 'price',
    });
    assert.equal(rejected.quote.status, 'rejected');

    // Re-seed issued for expire path
    supabase._quotes.set('q7', {
      id: 'q7',
      tenant_id: 'tvg',
      lead_id: 'l2',
      status: 'issued',
      total_amount: 50,
      quote_version: 1,
    });
    const expired = await svc.expireQuote({
      quoteId: 'q7',
      sessionTenantId: 'tvg',
      urlTenantId: 'tvg',
      actorId: 'u1',
      actorRole: 'office',
    });
    assert.equal(expired.quote.status, 'expired');

    supabase._quotes.set('q8', {
      id: 'q8',
      tenant_id: 'tvg',
      lead_id: 'l3',
      status: 'issued',
      total_amount: 75,
      quote_version: 2,
      service_address: '2 Oak',
      notes: 'n',
    });
    const revised = await svc.reviseQuote({
      quoteId: 'q8',
      sessionTenantId: 'tvg',
      urlTenantId: 'tvg',
      actorId: 'u1',
      actorRole: 'office',
    });
    assert.equal(revised.action, 'revise');
    assert.equal(revised.quote.status, 'draft');
    assert.equal(revised.quote.quote_version, 3);
    assert.equal(revised.superseded, 'q8');
    assert.equal(supabase._quotes.get('q8').status, 'revised');
    assert.equal(revised.jobCreated, false);
  });

  it('customer public-token approve (designated accept)', async () => {
    const supabase = makeQuoteStore([
      {
        id: 'q-tok',
        tenant_id: 'tvg',
        lead_id: 'l1',
        status: 'issued',
        total_amount: 40,
        public_token: 'tok-abc',
      },
    ]);
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    const result = await svc.approveByPublicToken({
      publicToken: 'tok-abc',
      actorId: 'cust-token',
    });
    assert.equal(result.quote.status, 'accepted');
    assert.equal(result.jobCreated, false);
  });

  it('S-04: estimates create path remains DENY', () => {
    const d = denyEstimatesCreate();
    assert.equal(d.ok, false);
    assert.throws(() => assertEstimatesCreateAllowed());
  });

  it('DENY transition issued→issue and draft→approve', async () => {
    const supabase = makeQuoteStore([
      { id: 'q9', tenant_id: 'tvg', lead_id: 'l1', status: 'issued', total_amount: 1 },
      { id: 'q10', tenant_id: 'tvg', lead_id: 'l1', status: 'draft', total_amount: 1 },
    ]);
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    await assert.rejects(
      () =>
        svc.issueQuote({
          quoteId: 'q9',
          sessionTenantId: 'tvg',
          urlTenantId: 'tvg',
          actorId: 'u1',
          actorRole: 'office',
        }),
      (e) => e.code === 'ML_P1_S2_TRANSITION_DENY',
    );
    await assert.rejects(
      () =>
        svc.approveQuote({
          quoteId: 'q10',
          sessionTenantId: 'tvg',
          urlTenantId: 'tvg',
          actorId: 'c1',
          actorRole: 'customer',
        }),
      (e) => e.code === 'ML_P1_S2_TRANSITION_DENY',
    );
  });
});

describe('ML-P1 S2 statuses contract coverage', () => {
  it('exposes required Money-State statuses', () => {
    for (const s of ['draft', 'issued', 'approved', 'rejected', 'expired', 'revised']) {
      assert.ok(Object.values(ML_P1_S2_STATUSES).includes(s) || s === 'approved');
    }
    assert.equal(ML_P1_S2_STATUSES.APPROVED, 'approved');
    assert.equal(ML_P1_S2_STATUSES.ISSUED, 'issued');
  });
});
