/**
 * ML-P1 Slice 4 — source guards + client authz + adversarial sentinels (SOURCE/unit).
 * Run: node --test tests/unit/ml-p1-s4-execution.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canPerformS4,
  assertS4Capability,
  ML_P1_S4_CAPABILITIES,
  formatS4StatusLabel,
  isDispatchedDerived,
  nextFieldActionsForStatus,
} from '../../src/lib/mlP1S4RoleAuthz.js';
import { createMlP1S4JobExecutionService } from '../../src/services/mlP1S4JobExecutionService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('ML-P1 S4 migration source guards', () => {
  const schema = read('supabase/migrations/20260722120000_ml_p1_s4_execution_schema.sql');
  const rpcs = read('supabase/migrations/20260722121000_ml_p1_s4_execution_rpcs.sql');
  const compat = read('supabase/migrations/20260722122000_ml_p1_s4_s3_writer_compat.sql');

  it('legalizes new statuses and creates CO / time / make-safe tables', () => {
    assert.match(schema, /arrived/);
    assert.match(schema, /no_access/);
    assert.match(schema, /reschedule_required/);
    assert.match(schema, /completion_pending/);
    assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.change_orders/);
    assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.job_time_events/);
    assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.job_make_safe_events/);
    assert.match(schema, /job_make_safe_never_billable CHECK \(billable = false\)/);
  });

  it('installs alternate-writer guard and appointment sync writer context', () => {
    assert.match(schema, /ML_P1_S4_ALT_WRITER_DENY/);
    assert.match(schema, /ml_p1_s4_set_writer_context/);
    assert.match(schema, /trg_ml_p1_s4_guard_job_execution_write/);
    assert.match(schema, /PERFORM public\.ml_p1_s4_set_writer_context\(\)/);
  });

  it('defines canonical RPCs without invoice/quote mutation', () => {
    assert.match(rpcs, /ml_p1_s4_job_transition/);
    assert.match(rpcs, /ml_p1_s4_change_order_propose/);
    assert.match(rpcs, /ml_p1_s4_change_order_transition/);
    assert.match(rpcs, /ml_p1_s4_completion_readiness/);
    assert.match(rpcs, /invoice_created', false/);
    assert.match(rpcs, /ML_P1_S4_TECH_SELF_APPROVE_DENY/);
    assert.match(rpcs, /ML_P1_S4_BREAK_GLASS_PROOF_REQUIRED/);
    assert.match(rpcs, /ML_P1_S4_STALE_CLIENT/);
    assert.match(rpcs, /ML_P1_S4_COMPLETION_BLOCKED/);
    assert.equal(/INSERT\s+INTO\s+public\.invoices/i.test(rpcs), false);
    assert.equal(/UPDATE\s+public\.quotes/i.test(rpcs), false);
  });

  it('preserves S3 writer quote_number text cast under S4 compat', () => {
    assert.match(compat, /ml_p1_s4_set_writer_context/);
    assert.match(compat, /quote_number::text/);
    assert.match(compat, /ml_p1_s3_ensure_job_for_accepted_quote/);
  });
});

describe('ML-P1 S4 edge invoice-on-complete gate', () => {
  const edge = read('supabase/functions/work-order-update/index.ts');
  const kanban = read('supabase/functions/kanban-move/index.ts');
  const jobService = read('src/services/jobService.js');
  const amend = read('supabase/migrations/20260722130000_ml_p1_s4_control_amendment.sql');

  it('disables invoice-on-complete and denies legacy execution writer path', () => {
    assert.match(edge, /ML_P1_S4_INVOICE_ON_COMPLETE_ENABLED = false/);
    assert.match(edge, /ML_P1_S4_USE_CANONICAL_WRITER/);
    assert.match(edge, /ml_p1_s4_invoice_on_complete_disabled/);
    assert.match(edge, /if \(ML_P1_S4_INVOICE_ON_COMPLETE_ENABLED\)/);
  });

  it('denies kanban job completion and invoice create writers', () => {
    assert.match(kanban, /ML_P1_S4_USE_CANONICAL_WRITER/);
    assert.match(kanban, /ML_P1_S4_INVOICE_PATH_DENY/);
    assert.equal(/status:\s*'completed'/.test(kanban), false);
  });

  it('denies local direct jobs.update fallback', () => {
    assert.match(jobService, /ML_P1_S4_ALT_WRITER_DENY/);
    assert.equal(/\.from\('jobs'\)\s*\n\s*\.update\(nextPatch\)/.test(jobService), false);
  });

  it('control amendment encodes make-safe / break-glass / operational time', () => {
    assert.match(amend, /ML_P1_S4_MAKE_SAFE_EVIDENCE_REQUIRED/);
    assert.match(amend, /ML_P1_S4_BREAK_GLASS_EVIDENCE_REQUIRED/);
    assert.match(amend, /record_class = 'operational_only'/);
    assert.match(amend, /pending_office_review/);
    assert.match(amend, /ml_p1_s4_correct_time_event/);
  });
});

describe('ML-P1 S4 role authz (PD-S4-02)', () => {
  it('T-S4-08 technician cannot approve change orders', () => {
    assert.equal(canPerformS4(ML_P1_S4_CAPABILITIES.CO_APPROVE_CUSTOMER, 'technician'), false);
    assert.equal(canPerformS4(ML_P1_S4_CAPABILITIES.CO_APPROVE_BREAK_GLASS, 'technician'), false);
    assert.equal(canPerformS4(ML_P1_S4_CAPABILITIES.CO_PROPOSE, 'technician'), true);
    assert.throws(
      () => assertS4Capability(ML_P1_S4_CAPABILITIES.CO_APPROVE_BREAK_GLASS, 'technician'),
      /DENY/,
    );
  });

  it('break-glass requires reason', () => {
    assert.throws(
      () => assertS4Capability(ML_P1_S4_CAPABILITIES.CO_APPROVE_BREAK_GLASS, 'admin'),
      /reason/,
    );
    assert.doesNotThrow(() =>
      assertS4Capability(ML_P1_S4_CAPABILITIES.CO_APPROVE_BREAK_GLASS, 'admin', {
        reasonCode: 'customer_verbal',
      }),
    );
  });

  it('PD-S4-05 vocabulary helpers', () => {
    assert.equal(formatS4StatusLabel('en_route'), 'On the way');
    assert.equal(formatS4StatusLabel('on_hold'), 'Paused');
    assert.equal(formatS4StatusLabel('completion_pending'), 'Completion pending');
    assert.equal(isDispatchedDerived({ status: 'scheduled', technician_id: 't1', scheduled_start: 'x' }), true);
    assert.equal(isDispatchedDerived({ status: 'scheduled', technician_id: null, scheduled_start: 'x' }), false);
    assert.deepEqual(nextFieldActionsForStatus('scheduled'), ['on_my_way']);
  });
});

describe('ML-P1 S4 client service adversarial wiring', () => {
  it('T-S4-01/02/03 calls canonical RPCs with mutation ids (no direct jobs update)', async () => {
    const calls = [];
    const fakeSupabase = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { job_id: args.p_job_id, status: 'en_route', invoice_created: false }, error: null };
      },
      from() {
        throw new Error('direct table write not allowed in this test');
      },
    };
    const svc = createMlP1S4JobExecutionService({ supabase: fakeSupabase });
    await svc.onMyWay('job-1');
    await svc.completeSubmit('job-1', { clientMutationId: 'mut-complete-1' });
    await svc.completeSubmit('job-1', { clientMutationId: 'mut-complete-1' });
    assert.equal(calls[0].name, 'ml_p1_s4_job_transition');
    assert.equal(calls[0].args.p_action, 'on_my_way');
    assert.ok(calls[0].args.p_client_mutation_id);
    assert.equal(calls[1].args.p_client_mutation_id, 'mut-complete-1');
    assert.equal(calls[2].args.p_client_mutation_id, 'mut-complete-1');
  });

  it('T-S4-12 service never exposes invoice create helper', () => {
    const svc = createMlP1S4JobExecutionService({
      supabase: { rpc: async () => ({ data: {}, error: null }) },
    });
    assert.equal(typeof svc.createInvoice, 'undefined');
    assert.equal(typeof svc.ensureInvoice, 'undefined');
  });
});

describe('ML-P1 S4 UI surfaces wired', () => {
  it('tech + office panels import canonical service', () => {
    const tech = read('src/components/tech/TechJobExecutionPanel.jsx');
    const office = read('src/components/crm/jobs/OfficeJobExecutionPanel.jsx');
    const detail = read('src/pages/tech/TechJobDetail.jsx');
    assert.match(tech, /createMlP1S4JobExecutionService/);
    assert.match(tech, /PD-S4-01/);
    assert.match(tech, /PD-S4-02/);
    assert.match(office, /Break-glass approve/);
    assert.match(office, /No invoice on complete/);
    assert.match(detail, /TechJobExecutionPanel/);
  });
});
