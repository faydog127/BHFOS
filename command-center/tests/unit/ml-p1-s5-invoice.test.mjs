/**
 * ML-P1 Slice 5 — source guards + client authz (SOURCE/unit).
 * Run: node --test tests/unit/ml-p1-s5-invoice.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canPerformS5,
  formatInvoiceStatusLabel,
  ML_P1_S5_CAPABILITIES,
  normalizeS5Role,
} from '../../src/lib/mlP1S5InvoiceAuthz.js';
import { createMlP1S5InvoiceService } from '../../src/services/mlP1S5InvoiceService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('ML-P1 S5 migration source guards', () => {
  const schema = read('supabase/migrations/20260723120000_ml_p1_s5_invoice_schema.sql');
  const rpcs = read('supabase/migrations/20260723121000_ml_p1_s5_invoice_rpcs.sql');
  const auto = read('supabase/migrations/20260723122000_ml_p1_s5_auto_draft_trigger.sql');

  it('adds lineage / void / mutation ledger columns', () => {
    assert.match(schema, /source_quote_version/);
    assert.match(schema, /approved_change_order_ids/);
    assert.match(schema, /calculation_snapshot/);
    assert.match(schema, /void_reason/);
    assert.match(schema, /s5_created/);
    assert.match(schema, /CREATE TABLE IF NOT EXISTS public\.invoice_execution_mutations/);
    assert.match(schema, /source_kind/);
  });

  it('defines canonical RPCs with PD-S5 gates', () => {
    assert.match(rpcs, /ml_p1_s5_invoice_readiness/);
    assert.match(rpcs, /ml_p1_s5_invoice_create/);
    assert.match(rpcs, /ml_p1_s5_invoice_draft_update/);
    assert.match(rpcs, /ml_p1_s5_invoice_issue/);
    assert.match(rpcs, /ml_p1_s5_invoice_void/);
    assert.match(rpcs, /invoice_type',\s*'final'/);
    assert.match(rpcs, /status = 'sent'/);
    assert.match(rpcs, /display_status', 'Issued'/);
    assert.match(rpcs, /ML_P1_S5_ISSUED_IMMUTABLE/);
    assert.match(rpcs, /ML_P1_S5_VOID_REASON_REQUIRED/);
    assert.match(rpcs, /ML_P1_S5_VOID_NOT_ALLOWED_AFTER_PAYMENT/);
    assert.match(rpcs, /pricebook_used', false/);
    assert.equal(/FROM\s+public\.price_book/i.test(rpcs), false);
    assert.match(rpcs, /ml_p1_s5_role_can_write_off/);
  });

  it('auto-drafts on completed without auto-issue', () => {
    assert.match(auto, /ml_p1_s5_job_completed_auto_draft/);
    assert.match(auto, /ml_p1_s5_invoice_create\(NEW\.id, v_mut, true\)/);
    assert.match(auto, /InvoiceAutoDraftFailed/);
    assert.equal(/ml_p1_s5_invoice_issue/.test(auto), false);
    assert.equal(/status\s*=\s*'sent'/.test(auto), false);
  });
});

describe('ML-P1 S5 alternate writer denials', () => {
  const edge = read('supabase/functions/work-order-update/index.ts');
  const money = read('src/pages/crm/MyMoney.jsx');
  const invoices = read('src/pages/crm/Invoices.jsx');
  const panel = read('src/components/crm/jobs/OfficeInvoicePanel.jsx');
  const jobs = read('src/pages/crm/Jobs.jsx');

  it('denies Edge ensure/create invoice writers', () => {
    assert.match(edge, /ML_P1_S5_ALT_WRITER_DENY/);
    assert.match(edge, /use canonical ml_p1_s5_invoice_create/);
    assert.match(edge, /ML_P1_S4_INVOICE_ON_COMPLETE_ENABLED = false/);
  });

  it('denies MyMoney direct invoice create', () => {
    assert.match(money, /ML_P1_S5_ALT_WRITER_DENY/);
    assert.equal(/\.from\('invoices'\)\s*\n\s*\.insert\(/.test(money), false);
  });

  it('displays Issued for sent and wires office panel', () => {
    assert.match(invoices, />Issued</);
    assert.match(panel, /createMlP1S5InvoiceService/);
    assert.match(panel, /formatInvoiceStatusLabel/);
    assert.match(jobs, /OfficeInvoicePanel/);
  });
});

describe('ML-P1 S5 role authz (PD-S5-05)', () => {
  it('maps csr to office capabilities', () => {
    assert.equal(normalizeS5Role('csr'), 'office');
    assert.equal(canPerformS5('csr', 'create'), true);
    assert.equal(canPerformS5('office', 'issue'), true);
    assert.equal(canPerformS5('manager', 'void'), true);
  });

  it('technician never creates/issues/voids/write-offs', () => {
    assert.equal(canPerformS5('technician', 'create'), false);
    assert.equal(canPerformS5('technician', 'issue'), false);
    assert.equal(canPerformS5('technician', 'void'), false);
    assert.equal(canPerformS5('technician', 'writeOff'), false);
  });

  it('write-off is admin only', () => {
    assert.deepEqual(ML_P1_S5_CAPABILITIES.writeOff, ['admin']);
    assert.equal(canPerformS5('admin', 'writeOff'), true);
    assert.equal(canPerformS5('office', 'writeOff'), false);
    assert.equal(canPerformS5('manager', 'writeOff'), false);
  });

  it('formats sent as Issued (PD-S5-02)', () => {
    assert.equal(formatInvoiceStatusLabel('sent'), 'Issued');
    assert.equal(formatInvoiceStatusLabel('draft'), 'Draft');
    assert.equal(formatInvoiceStatusLabel('void'), 'Void');
  });
});

describe('ML-P1 S5 client service facade', () => {
  it('calls only S5 RPCs (no direct invoices insert)', async () => {
    const calls = [];
    const supabase = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { ok: true, name }, error: null };
      },
      from: () => {
        throw new Error('direct table access unexpected in create path');
      },
    };
    const svc = createMlP1S5InvoiceService({ supabase });
    await svc.create('job-1', { clientMutationId: 'm1' });
    await svc.issue('inv-1', { clientMutationId: 'm2' });
    await svc.void('inv-1', 'wrong total', { clientMutationId: 'm3' });
    assert.equal(calls[0].name, 'ml_p1_s5_invoice_create');
    assert.equal(calls[0].args.p_system, false);
    assert.equal(calls[1].name, 'ml_p1_s5_invoice_issue');
    assert.equal(calls[2].name, 'ml_p1_s5_invoice_void');
    assert.equal(calls[2].args.p_reason, 'wrong total');
  });
});
