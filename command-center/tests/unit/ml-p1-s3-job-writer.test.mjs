/**
 * ML-P1 Slice 3 — canonical job writer source guards + client surface.
 * Run: node --test tests/unit/ml-p1-s3-job-writer.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMlP1S2QuoteLifecycleService } from '../../src/services/mlP1S2QuoteLifecycleService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

describe('ML-P1 S3 migration source guards', () => {
  const migPath = path.join(
    root,
    'supabase/migrations/20260721200000_ml_p1_s3_canonical_job_writer.sql',
  );
  const mig = fs.readFileSync(migPath, 'utf8');

  it('defines canonical writer + lineage column', () => {
    assert.match(mig, /source_quote_version/);
    assert.match(mig, /ml_p1_s3_ensure_job_for_accepted_quote/);
    assert.match(mig, /ML_P1_S3_ADDRESS_REQUIRED/);
    assert.match(mig, /QuoteAccepted_JobEnsured/);
    assert.match(mig, /ON CONFLICT \(quote_id\) WHERE quote_id IS NOT NULL/);
  });

  it('does not enable auto_create_job_on_quote_acceptance', () => {
    assert.equal(
      /UPDATE\s+public\.global_config[\s\S]{0,200}auto_create_job_on_quote_acceptance/i.test(mig),
      false,
    );
    assert.equal(
      /INSERT\s+INTO\s+public\.global_config[\s\S]{0,200}auto_create_job_on_quote_acceptance[\s\S]{0,80}'true'/i.test(
        mig,
      ),
      false,
    );
  });

  it('neutralizes ensure_job accepted/paid inserts (deferred only)', () => {
    assert.match(mig, /QuoteAccepted_JobCreateDeferred/);
    assert.match(mig, /QuotePaid_JobCreateDeferred/);
    assert.match(mig, /ml-p1-s3-rpc-only-job-writer/);
    // ensure_job body in this migration must not INSERT into jobs.
    const ensureStart = mig.indexOf(
      'CREATE OR REPLACE FUNCTION public.ensure_job_and_optional_draft_invoice_for_accepted_quote()',
    );
    const ensureEnd = mig.indexOf(
      'CREATE OR REPLACE FUNCTION public.trg_emit_wo_on_quote_accept()',
      ensureStart,
    );
    assert.ok(ensureStart > 0 && ensureEnd > ensureStart);
    const ensureBody = mig.slice(ensureStart, ensureEnd);
    assert.equal(/INSERT INTO public\.jobs/i.test(ensureBody), false);
  });

  it('drops S2 gate-off accept belt and removes approve gate asserts', () => {
    assert.match(mig, /DROP TRIGGER IF EXISTS trg_ml_p1_s2_require_job_gate_off_on_accept/);
    assert.equal(/ML_P1_S2_JOB_GATE_REQUIRED/.test(mig), false);
    assert.equal(/ml_p1_s2_job_gate_is_off\(\)/.test(mig), false);
  });

  it('wires both approve RPCs to canonical writer', () => {
    assert.match(mig, /ml_p1_s2_quote_lifecycle/);
    assert.match(mig, /ml_p1_s2_quote_approve_public/);
    const writerCalls = [...mig.matchAll(/ml_p1_s3_ensure_job_for_accepted_quote/g)];
    assert.ok(writerCalls.length >= 5, `expected multiple writer call sites, got ${writerCalls.length}`);
  });

  it('rejects cross-tenant job squat and pins total_amount on idempotent hit', () => {
    assert.match(mig, /ML_P1_S3_TENANT_DENY: existing job tenant mismatch/);
    assert.match(mig, /total_amount = v_amount/);
    assert.match(mig, /quote_id IS NULL/);
    // ON CONFLICT recovery must re-check tenant
    assert.ok(
      (mig.match(/ML_P1_S3_TENANT_DENY: existing job tenant mismatch for quote/g) || []).length >= 2,
    );
  });

  it('allows sent/viewed approve and ensure_job repair', () => {
    assert.match(mig, /WHEN 'approve' THEN v_status IN \('issued', 'sent', 'viewed'\)/);
    assert.match(mig, /WHEN 'ensure_job'/);
    assert.match(mig, /office_break_glass_ensure/);
  });
});

describe('ML-P1 S3 edge / UI source guards', () => {
  it('quote-update-status denies accept/approve money path', () => {
    const src = fs.readFileSync(
      path.join(root, 'supabase/functions/quote-update-status/index.ts'),
      'utf8',
    );
    assert.match(src, /ML_P1_S3_STATUS_PATH_DENY/);
    assert.match(src, /accepted.*approved|approved.*accepted/s);
    assert.equal(/closeFollowUpTasks/.test(src), false);
  });

  it('kanban-move cannot insert quote-linked jobs or accept via status write', () => {
    const src = fs.readFileSync(
      path.join(root, 'supabase/functions/kanban-move/index.ts'),
      'utf8',
    );
    assert.match(src, /ML_P1_S3_JOB_REQUIRED/);
    assert.match(src, /ML_P1_S3_STATUS_PATH_DENY/);
    assert.equal(/\.insert\(richInsert\)/.test(src), false);
    assert.equal(/status:\s*'accepted'/.test(src), false);
  });

  it('ProposalList Accept navigates to lifecycle (no quote-update-status accept)', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/pages/crm/proposals/ProposalList.jsx'),
      'utf8',
    );
    assert.equal(/handleUpdateStatus\(quote\.id,\s*'accepted'\)/.test(src), false);
    assert.match(src, /estimates\/p1-lifecycle\//);
  });

  it('lifecycle page shows job status surface and ensure-job repair', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/pages/crm/MlP1S2QuoteLifecyclePage.jsx'),
      'utf8',
    );
    assert.match(src, /Job status/);
    assert.match(src, /jobCreated/);
    assert.match(src, /Idempotent \(existing\)/);
    assert.match(src, /ensureJobForQuote/);
    assert.match(src, /sent.*viewed|viewed.*sent/s);
  });
});

describe('ML-P1 S3 client normalizeRpcResult', () => {
  it('maps job_id snake_case from RPC payload', async () => {
    const supabase = {
      rpc: async () => ({
        data: {
          action: 'approve',
          job_created: true,
          job_id: 'j-snake',
          quote: { id: 'q1', status: 'accepted' },
        },
        error: null,
      }),
    };
    const svc = createMlP1S2QuoteLifecycleService({ supabase });
    const result = await svc.approveByPublicToken({ publicToken: 't' });
    assert.equal(result.jobCreated, true);
    assert.equal(result.jobId, 'j-snake');
  });
});
