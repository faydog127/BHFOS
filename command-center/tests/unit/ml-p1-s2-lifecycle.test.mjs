/**
 * ML-P1 Slice 2 — lifecycle + R-S1-03 + remediation adversarial cases.
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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ML-P1 S2 R-S1-03 role matrix (client helper — server is source of truth)', () => {
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

describe('ML-P1 S2 transitions + immutability helpers', () => {
  it('allows Money-State happy path transitions only', () => {
    assertTransitionAllowed('issue', 'draft');
    assertTransitionAllowed('approve', 'issued');
    assert.throws(() => assertTransitionAllowed('approve', 'draft'), (e) => e.code === 'ML_P1_S2_TRANSITION_DENY');
  });

  it('blocks in-place edit of issued/approved content', () => {
    assert.throws(() => assertQuoteMutableForEdit('issued'), (e) => e.code === 'ML_P1_S2_IMMUTABLE');
    assert.equal(assertQuoteMutableForEdit('draft'), true);
  });

  it('normalizes approved → accepted', () => {
    assert.equal(normalizeQuoteStatus('approved'), 'accepted');
  });
});

describe('ML-P1 S2 audit G-02 fields', () => {
  it('builds complete issued audit payloads with version fields available', () => {
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
      related: { lead_id: 'l1', quote_version: 2 },
    });
    assert.equal(assertAuditPayloadComplete(row.payload).ok, true);
  });
});

describe('ML-P1 S2 lifecycle service via server RPC', () => {
  it('issues via RPC and always returns jobCreated false', async () => {
    const calls = [];
    const supabase = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        assert.equal(name, 'ml_p1_s2_quote_lifecycle');
        return {
          data: {
            action: 'issue',
            jobCreated: true, // hostile server — client must still report false
            correlationId: 'c-issue',
            quote: { id: 'q1', status: 'issued', tenant_id: 'tvg' },
          },
          error: null,
        };
      },
    };
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    const result = await svc.issueQuote({
      quoteId: 'q1',
      sessionTenantId: 'tvg',
      urlTenantId: 'tvg',
      actorRole: 'technician', // forged — server ignores; client still calls RPC
    });
    assert.equal(result.jobCreated, false);
    assert.equal(result.quote.status, 'issued');
    assert.equal(calls[0].args.p_action, 'issue');
  });

  it('maps server ROLE_DENY for technician', async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'ML_P1_S2_ROLE_DENY: role "technician" cannot perform quote.issue' },
      }),
    };
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    await assert.rejects(
      () =>
        svc.issueQuote({
          quoteId: 'q1',
          sessionTenantId: 'tvg',
          urlTenantId: 'tvg',
          actorRole: 'office',
        }),
      (err) => err.code === ROLE_AUTHZ_DENY_CODE,
    );
  });

  it('DENY missing session tenant before RPC', async () => {
    const supabase = { rpc: async () => ({ data: null, error: null }) };
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    await assert.rejects(
      () =>
        svc.issueQuote({
          quoteId: 'q1',
          urlTenantId: 'tvg',
          actorRole: 'office',
        }),
      (err) => err.code === TENANT_DENY_CODE,
    );
  });

  it('approve break-glass maps reason required from server', async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: {
          message:
            'ML_P1_S2_BREAK_GLASS_REASON_REQUIRED: admin break-glass approve requires reason_code',
        },
      }),
    };
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    await assert.rejects(
      () =>
        svc.approveQuote({
          quoteId: 'q1',
          sessionTenantId: 'tvg',
          urlTenantId: 'tvg',
          actorRole: 'admin',
        }),
      (err) => err.code === 'ML_P1_S2_BREAK_GLASS_REASON_REQUIRED',
    );
  });

  it('public-token approve via RPC; concurrent idempotent safe', async () => {
    let n = 0;
    const supabase = {
      rpc: async (name) => {
        assert.equal(name, 'ml_p1_s2_quote_approve_public');
        n += 1;
        return {
          data: {
            action: 'approve',
            jobCreated: false,
            idempotent: n > 1,
            quote: { id: 'q-tok', status: 'accepted', approved_amount: 40 },
          },
          error: null,
        };
      },
    };
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    const a = await svc.approveByPublicToken({ publicToken: 'tok-abc' });
    const b = await svc.approveByPublicToken({ publicToken: 'tok-abc' });
    assert.equal(a.jobCreated, false);
    assert.equal(b.jobCreated, false);
    assert.equal(b.idempotent, true);
  });

  it('revise via RPC returns new draft and jobCreated false', async () => {
    const supabase = {
      rpc: async (_name, args) => {
        assert.equal(args.p_action, 'revise');
        return {
          data: {
            action: 'revise',
            jobCreated: false,
            superseded: 'q8',
            quote: { id: 'q-new', status: 'draft', quote_version: 3 },
          },
          error: null,
        };
      },
    };
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    const revised = await svc.reviseQuote({
      quoteId: 'q8',
      sessionTenantId: 'tvg',
      urlTenantId: 'tvg',
      actorRole: 'office',
    });
    assert.equal(revised.action, 'revise');
    assert.equal(revised.quote.quote_version, 3);
    assert.equal(revised.jobCreated, false);
  });

  it('JOB_GATE_REQUIRED mapped from server (pre-A3 fail-closed)', async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: {
          message:
            'ML_P1_S2_JOB_GATE_REQUIRED: cannot approve until auto_create_job_on_quote_acceptance=false',
        },
      }),
    };
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    await assert.rejects(
      () =>
        svc.approveQuote({
          quoteId: 'q1',
          sessionTenantId: 'tvg',
          urlTenantId: 'tvg',
          actorRole: 'admin',
          reasonCode: 'bg-1',
        }),
      (err) => err.code === 'ML_P1_S2_JOB_GATE_REQUIRED',
    );
  });

  it('S-04: estimates create path remains DENY', () => {
    const d = denyEstimatesCreate();
    assert.equal(d.ok, false);
    assert.throws(() => assertEstimatesCreateAllowed());
  });
});

describe('ML-P1 S2 remediation source guards', () => {
  it('public-quote-approve no longer inserts jobs', () => {
    const edgePath = path.join(
      __dirname,
      '../../supabase/functions/public-quote-approve/index.ts',
    );
    const src = fs.readFileSync(edgePath, 'utf8');
    assert.equal(/from\('jobs'\)/.test(src), false);
    assert.match(src, /ML_P1_S2_JOB_GATE_REQUIRED/);
    assert.match(src, /job_created:\s*false/);
    assert.match(src, /ml_p1_s2_quote_approve_public/);
  });

  it('server authz migration defines RPC + gate-off accept trigger + draft-only RLS', () => {
    const mig = fs.readFileSync(
      path.join(
        __dirname,
        '../../supabase/migrations/20260721170000_ml_p1_s2_lifecycle_server_authz.sql',
      ),
      'utf8',
    );
    assert.match(mig, /ml_p1_s2_quote_lifecycle/);
    assert.match(mig, /ml_p1_s2_quote_approve_public/);
    assert.match(mig, /ml_p1_s2_job_gate_is_off/);
    assert.match(mig, /trg_ml_p1_s2_require_job_gate_off_on_accept/);
    assert.match(mig, /Quotes draft updatable by tenant/);
    assert.match(mig, /FOR UPDATE/);
  });

  it('exposes required Money-State statuses', () => {
    assert.equal(ML_P1_S2_STATUSES.APPROVED, 'approved');
    assert.equal(ML_P1_S2_STATUSES.ISSUED, 'issued');
  });
});
