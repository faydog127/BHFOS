/**
 * ML-P1 Slice 1 foundation unit tests.
 * Run: node --test tests/unit/ml-p1-s1-foundation.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  ESTIMATES_CREATE_DENY_CODE,
  assertEstimatesCreateAllowed,
  denyEstimatesCreate,
  isEstimatesCreateDeniedError,
} from '../../src/lib/mlP1S1EstimatesDeny.js';
import {
  buildDuplicateCustomerFilters,
  normalizePhoneDigits,
  scoreDuplicateCandidate,
  sortDuplicateCandidates,
} from '../../src/lib/mlP1S1DuplicateCustomer.js';
import {
  assertStableCustomerLink,
  documentUuidBigintPolicy,
  resolveP1ServiceAddress,
} from '../../src/lib/mlP1S1Identity.js';
import {
  assertAuditPayloadComplete,
  buildMoneyStateAuditEvent,
  ML_P1_S1_EVENT_TYPES,
} from '../../src/lib/mlP1S1AuditEvents.js';
import {
  assertTenantMatch,
  isTenantDenyError,
  resolveWriteTenantId,
  TENANT_DENY_CODE,
} from '../../src/lib/mlP1S1Tenant.js';
import {
  endKpiTimer,
  getKpiSnapshot,
  incrementKpi,
  resetMlP1S1KpiStore,
  startKpiTimer,
} from '../../src/lib/mlP1S1Kpi.js';
import { createMlP1S1QuoteDraftService } from '../../src/services/mlP1S1QuoteDraftService.js';

describe('ML-P1 S1 estimates DENY', () => {
  it('denies estimates create with stable code', () => {
    const d = denyEstimatesCreate();
    assert.equal(d.ok, false);
    assert.equal(d.code, ESTIMATES_CREATE_DENY_CODE);
    assert.match(d.message, /canonical quotes/i);
  });

  it('throws assertEstimatesCreateAllowed', () => {
    assert.throws(() => assertEstimatesCreateAllowed(), (err) => {
      assert.equal(isEstimatesCreateDeniedError(err), true);
      return true;
    });
  });
});

describe('ML-P1 S1 duplicate customer', () => {
  it('normalizes phone to last 10 digits', () => {
    assert.equal(normalizePhoneDigits('(321) 555-1212'), '3215551212');
  });

  it('requires a strong signal', () => {
    const weak = buildDuplicateCustomerFilters({ last_name: 'Smith' });
    assert.equal(weak.ok, false);
  });

  it('builds filters for phone and ranks phone matches highest', () => {
    const built = buildDuplicateCustomerFilters({
      phone: '3215551212',
      last_name: 'Smith',
    });
    assert.equal(built.ok, true);
    assert.ok(built.filters.some((f) => f.includes('phone')));
    const ranked = sortDuplicateCandidates(
      { phone: '3215551212' },
      [
        { id: 'a', phone: '999' },
        { id: 'b', phone: '3215551212' },
      ],
    );
    assert.equal(ranked[0].id, 'b');
    assert.ok(scoreDuplicateCandidate({ phone: '3215551212' }, { phone: '3215551212' }) >= 100);
  });
});

describe('ML-P1 S1 identity / address', () => {
  it('resolves service address from address_line_1 alias', () => {
    const addr = resolveP1ServiceAddress({
      form: { address_line_1: '12 Main', city: 'Titusville', state: 'FL', zip: '32780' },
    });
    assert.match(addr, /12 Main/);
  });

  it('requires lead_id for stable link', () => {
    assert.throws(() => assertStableCustomerLink({}), (err) => err.code === 'ML_P1_S1_MISSING_LEAD_ID');
  });

  it('documents UUID/bigint deferral policy', () => {
    const p = documentUuidBigintPolicy();
    assert.match(p.status, /DEFER/);
  });
});

describe('ML-P1 S1 tenant', () => {
  it('prefers session tenant and denies mismatch', () => {
    assert.equal(resolveWriteTenantId({ sessionTenantId: 'tvg' }), 'tvg');
    assert.throws(
      () => resolveWriteTenantId({ sessionTenantId: 'tvg', urlTenantId: 'other' }),
      (err) => err.code === TENANT_DENY_CODE,
    );
  });

  it('blocks cross-tenant row access', () => {
    assert.throws(() => assertTenantMatch('a', 'b'), (err) => isTenantDenyError(err));
  });
});

describe('ML-P1 S1 audit', () => {
  it('builds complete payload fields', () => {
    const row = buildMoneyStateAuditEvent({
      tenantId: 'tvg',
      recordId: 'q1',
      actorRole: 'office',
      sourceAction: 'test',
      correlationId: 'c1',
      eventType: ML_P1_S1_EVENT_TYPES.DRAFT_CREATED,
      related: { lead_id: 'l1' },
    });
    assert.equal(row.event_type, ML_P1_S1_EVENT_TYPES.DRAFT_CREATED);
    const check = assertAuditPayloadComplete(row.payload);
    assert.equal(check.ok, true);
  });
});

describe('ML-P1 S1 KPI', () => {
  beforeEach(() => resetMlP1S1KpiStore());

  it('records timers and counters', () => {
    startKpiTimer('create_draft_quote');
    incrementKpi('draft_created');
    const ms = endKpiTimer('create_draft_quote');
    assert.equal(typeof ms, 'number');
    const snap = getKpiSnapshot();
    assert.equal(snap.counters.draft_created, 1);
  });
});

describe('ML-P1 S1 draft service idempotency + tenant', () => {
  it('reuses draft on matching idempotency key without second insert', async () => {
    const inserts = [];
    const fakeExisting = {
      id: 'quote-1',
      status: 'draft',
      lead_id: 'lead-1',
      tenant_id: 'tvg',
      notes: 's1-idem:abc',
    };
    const supabase = {
      from(table) {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          ilike() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          maybeSingle: async () => {
            if (table === 'quotes') return { data: fakeExisting, error: null };
            return { data: null, error: null };
          },
          insert(rows) {
            inserts.push({ table, rows });
            return {
              select() {
                return {
                  single: async () => ({ data: rows[0], error: null }),
                };
              },
            };
          },
        };
      },
    };

    const svc = createMlP1S1QuoteDraftService({ supabase });
    const result = await svc.createDraftQuote({
      lead: { id: 'lead-1', tenant_id: 'tvg', address: '1 Main St' },
      urlTenantId: 'tvg',
      idempotencyKey: 'abc',
    });
    assert.equal(result.idempotent, true);
    assert.equal(result.quote.id, 'quote-1');
    assert.equal(inserts.length, 0);
  });

  it('denies missing tenant', async () => {
    const svc = createMlP1S1QuoteDraftService({
      supabase: { from: () => ({}) },
    });
    await assert.rejects(
      () =>
        svc.createDraftQuote({
          lead: { id: 'lead-1', address: '1 Main' },
        }),
      (err) => err.code === TENANT_DENY_CODE,
    );
  });
});
