/**
 * ML-P1 S3 remediation — events.actor_id uuid for office lifecycle.
 * Run: node --test tests/unit/ml-p1-s3-lifecycle-actor-id.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const fixPath = path.join(
  root,
  'supabase/migrations/20260721210000_ml_p1_s3_lifecycle_actor_id_uuid.sql',
);
const s3Path = path.join(
  root,
  'supabase/migrations/20260721200000_ml_p1_s3_canonical_job_writer.sql',
);
const fix = fs.readFileSync(fixPath, 'utf8');
const s3 = fs.readFileSync(s3Path, 'utf8');

function lifecycleBody(sql) {
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.ml_p1_s2_quote_lifecycle(');
  const end = sql.indexOf('CREATE OR REPLACE FUNCTION public.ml_p1_s2_quote_approve_public(');
  // remediation file contains only lifecycle
  if (end < 0) return sql.slice(start);
  return sql.slice(start, end);
}

function eventInsertBlocks(sql) {
  return [...sql.matchAll(/INSERT INTO public\.events\s*\([\s\S]*?jsonb_build_object\(/g)].map(
    (m) => m[0],
  );
}

describe('ML-P1 S3 lifecycle actor_id uuid remediation', () => {
  it('office approval path writes UUID actor (auth.uid) into events.actor_id', () => {
    const body = lifecycleBody(fix);
    assert.match(body, /v_uid uuid := auth\.uid\(\)/);
    const blocks = eventInsertBlocks(body);
    assert.ok(blocks.length >= 2, `expected >=2 event inserts, got ${blocks.length}`);
    for (const block of blocks) {
      // Column slot must be uuid-typed v_uid, never v_uid::text
      assert.match(block, /v_role,\s*v_uid,/);
      assert.equal(/v_role,\s*v_uid::text,/.test(block), false);
    }
  });

  it('break-glass approve keeps reason_code capability + UUID actor + writer in-txn', () => {
    const body = lifecycleBody(fix);
    assert.match(body, /quote\.approve_break_glass/);
    assert.match(body, /p_reason_code/);
    assert.match(body, /ml_p1_s2_assert_capability/);
    const writerIdx = body.indexOf("ml_p1_s3_ensure_job_for_accepted_quote(");
    const officeWriter = body.indexOf("'office_break_glass'");
    const auditIdx = body.lastIndexOf('INSERT INTO public.events');
    assert.ok(writerIdx > 0 && officeWriter > writerIdx, 'office_break_glass writer present');
    assert.ok(auditIdx > officeWriter, 'audit after writer (same txn, no suppress)');
    assert.match(body, /v_role,\s*v_uid,/);
  });

  it('invalid/non-UUID free-form actor input is not accepted (auth.uid only)', () => {
    const body = lifecycleBody(fix);
    // No parameters for actor_id; actor comes only from auth.uid()
    assert.equal(/p_actor_id/.test(body), false);
    assert.equal(/actor_id\s*:=\s*.*::uuid/.test(body), false);
    assert.match(body, /IF v_uid IS NULL THEN/);
    assert.match(body, /ML_P1_S2_ROLE_DENY: unauthenticated actor/);
    // Must not cast untrusted text into events.actor_id
    assert.equal(/INSERT INTO public\.events[\s\S]{0,300}p_reason_code::uuid/.test(body), false);
    assert.equal(/INSERT INTO public\.events[\s\S]{0,300}p_correlation_id::uuid/.test(body), false);
  });

  it('audit event persists expected actor semantics (uuid column + payload)', () => {
    const body = lifecycleBody(fix);
    assert.match(body, /INSERT INTO public\.events \(tenant_id, entity_type, entity_id, event_type, actor_type, actor_id, payload\)/);
    assert.match(body, /'quote\.approved'/);
    assert.match(body, /'actor_id', v_uid::text/); // payload serialization OK
    assert.match(body, /approved_by_actor_id = v_uid::text/); // quotes text column unchanged
  });

  it('repeated office approval returns same job (idempotent ensure path preserved)', () => {
    const body = lifecycleBody(fix);
    assert.match(body, /idempotent', true/);
    assert.match(body, /normalize_quote_status\(v_quote\.status\) = 'accepted'/);
    assert.match(body, /v_action = 'ensure_job'/);
    assert.match(body, /office_break_glass_ensure/);
    assert.match(body, /idempotent', true/);
  });

  it('no partial approval/job/audit: writer + audit in same SECURITY DEFINER function', () => {
    const body = lifecycleBody(fix);
    assert.match(body, /SECURITY DEFINER/);
    assert.match(body, /ml_p1_s3_ensure_job_for_accepted_quote/);
    assert.match(body, /INSERT INTO public\.events/);
    // Must not swallow audit failures
    assert.equal(/EXCEPTION WHEN others THEN\s*NULL/i.test(body), false);
    assert.equal(/--\s*skip audit/i.test(body), false);
  });

  it('does not alter public approval NULL actor convention', () => {
    // Public function remains in S3 migration; remediation file must not redefine it.
    assert.equal(/ml_p1_s2_quote_approve_public/.test(fix), false);
    const pubStart = s3.indexOf('CREATE OR REPLACE FUNCTION public.ml_p1_s2_quote_approve_public(');
    const pubBody = s3.slice(pubStart);
    assert.match(
      pubBody,
      /INSERT INTO public\.events[\s\S]{0,250}'quote\.approved',\s*'customer',\s*NULL,/,
    );
    assert.match(pubBody, /'actor_id',\s*NULL/);
    assert.match(pubBody, /approved_by_actor_id = NULL/);
  });

  it('preserves deny / paid / writer controls from Slice 3 baseline', () => {
    assert.match(s3, /ML_P1_S3_STATUS_PATH_DENY|QuotePaid_JobCreateDeferred/);
    assert.match(s3, /QuotePaid_JobCreateDeferred/);
    assert.match(s3, /ml_p1_s3_ensure_job_for_accepted_quote/);
    // Remediation must not touch edge deny surfaces
    assert.equal(/quote-update-status/.test(fix), false);
    assert.equal(/kanban-move/.test(fix), false);
    assert.equal(/auto_create_job_on_quote_acceptance/.test(fix), false);
  });
});
