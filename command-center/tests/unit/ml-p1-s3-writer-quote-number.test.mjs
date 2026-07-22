/**
 * ML-P1 S3 — writer quote_number text coalesce for idempotent ensure.
 * Run: node --test tests/unit/ml-p1-s3-writer-quote-number.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const mig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260721211000_ml_p1_s3_writer_quote_number_text.sql'),
  'utf8',
);

describe('ML-P1 S3 writer quote_number text coalesce', () => {
  it('casts quote_number to text on idempotent coalesce paths', () => {
    const casts = mig.match(/coalesce\(v_quote\.quote_number::text, quote_number\)/g) || [];
    assert.ok(casts.length >= 2, `expected >=2 coalesce casts, got ${casts.length}`);
    assert.equal(/coalesce\(v_quote\.quote_number, quote_number\)/.test(mig), false);
  });

  it('casts quote_number on insert values', () => {
    assert.match(mig, /v_quote\.quote_number::text/);
  });

  it('preserves writer identity, NULL actor events, and tenant guards', () => {
    assert.match(mig, /ml_p1_s3_ensure_job_for_accepted_quote/);
    assert.match(mig, /QuoteAccepted_JobEnsured/);
    assert.match(mig, /ML_P1_S3_TENANT_DENY/);
    assert.match(mig, /actor_type, actor_id, payload\)[\s\S]{0,120}NULL,/);
  });
});
