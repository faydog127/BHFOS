/**
 * Media Intelligence — upload client completion / retry honesty.
 * Run: node --test tests/unit/media-intel-upload-client.test.mjs
 *
 * Loads pure helpers from uploadManager.js without Vite/Supabase runtime.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const uploadSrc = fs.readFileSync(path.join(root, 'src/lib/mediaIntel/uploadManager.js'), 'utf8');

function extractExport(src, kind, name) {
  const re =
    kind === 'const'
      ? new RegExp(`export const ${name} = Object\\.freeze\\(\\{[\\s\\S]*?\\}\\);`)
      : new RegExp(`export function ${name}\\([\\s\\S]*?\\n\\}`);
  const match = src.match(re);
  assert.ok(match, `expected export ${kind} ${name} in uploadManager.js`);
  return match[0].replace(/^export\s+/, '');
}

function loadPureHelpers() {
  const code = [
    extractExport(uploadSrc, 'const', 'UPLOAD_FILE_STATUS'),
    extractExport(uploadSrc, 'function', 'isRetryableCompletionStatus'),
    extractExport(uploadSrc, 'function', 'interpretCompletion'),
    '({ UPLOAD_FILE_STATUS, isRetryableCompletionStatus, interpretCompletion })',
  ].join('\n');
  return vm.runInNewContext(code);
}

const { UPLOAD_FILE_STATUS, isRetryableCompletionStatus, interpretCompletion } = loadPureHelpers();

describe('MIL upload client — interpretCompletion honesty', () => {
  it('HTTP 200 with uploaded payload → uploaded success', () => {
    const out = interpretCompletion({
      status: 200,
      payload: { status: 'uploaded', assetId: 'asset-1' },
    });
    assert.equal(out.status, UPLOAD_FILE_STATUS.UPLOADED);
    assert.equal(out.assetId, 'asset-1');
  });

  it('HTTP 200 with duplicate payload → duplicate success', () => {
    const out = interpretCompletion({
      status: 200,
      payload: { status: 'duplicate', existingAssetId: 'asset-dup' },
    });
    assert.equal(out.status, UPLOAD_FILE_STATUS.DUPLICATE);
    assert.equal(out.existingAssetId, 'asset-dup');
  });

  it('only HTTP 200 may yield uploaded or duplicate', () => {
    const successStatuses = new Set([UPLOAD_FILE_STATUS.UPLOADED, UPLOAD_FILE_STATUS.DUPLICATE]);
    for (const status of [202, 403, 409, 410, 500, 503, 0]) {
      const out = interpretCompletion({
        status,
        payload: { status: 'uploaded', assetId: 'x', code: 'in_progress', error: 'nope' },
      });
      assert.ok(
        !successStatuses.has(out.status),
        `status ${status} must not become success, got ${out.status}`,
      );
    }
  });

  it('HTTP 202 → pending_reconcile (never success)', () => {
    const out = interpretCompletion({
      status: 202,
      payload: { status: 'pending_reconcile', grantId: 'g-1', error: 'still placing' },
    });
    assert.equal(out.status, UPLOAD_FILE_STATUS.PENDING_RECONCILE);
    assert.equal(out.grantId, 'g-1');
    assert.match(out.message, /still placing/);
    assert.notEqual(out.status, UPLOAD_FILE_STATUS.UPLOADED);
    assert.notEqual(out.status, UPLOAD_FILE_STATUS.DUPLICATE);
  });

  it('HTTP 410 → expired', () => {
    const out = interpretCompletion({
      status: 410,
      payload: { error: 'Session expired' },
    });
    assert.equal(out.status, UPLOAD_FILE_STATUS.EXPIRED);
    assert.match(out.message, /Session expired/);
  });

  it('HTTP 403 → revoked', () => {
    const out = interpretCompletion({
      status: 403,
      payload: { error: 'Revoked by admin' },
    });
    assert.equal(out.status, UPLOAD_FILE_STATUS.REVOKED);
    assert.match(out.message, /Revoked by admin/);
  });

  it('HTTP 409 in_progress → in_progress (not failed/success)', () => {
    const out = interpretCompletion({
      status: 409,
      payload: { code: 'in_progress' },
    });
    assert.equal(out.status, UPLOAD_FILE_STATUS.IN_PROGRESS);
  });

  it('non-success statuses map to failed (including persistent 503)', () => {
    for (const status of [400, 500, 503]) {
      const out = interpretCompletion({
        status,
        payload: { error: `boom-${status}`, code: 'server' },
      });
      assert.equal(out.status, UPLOAD_FILE_STATUS.FAILED, `expected failed for ${status}`);
      assert.equal(out.code, 'server');
      assert.match(out.message, new RegExp(`boom-${status}`));
    }
  });
});

describe('MIL upload client — 503 / network retry honesty', () => {
  it('isRetryableCompletionStatus is true only for 503 and network 0', () => {
    assert.equal(isRetryableCompletionStatus(503), true);
    assert.equal(isRetryableCompletionStatus(0), true);
    for (const status of [200, 202, 403, 409, 410, 500, 502, 504]) {
      assert.equal(isRetryableCompletionStatus(status), false, `status ${status}`);
    }
  });

  it('completeFile retries exactly once on retryable status, then interprets', () => {
    // Source contract: one delayed retry gated by isRetryableCompletionStatus, then interpretCompletion.
    assert.match(uploadSrc, /if \(isRetryableCompletionStatus\(result\.status\)\)/);
    assert.match(uploadSrc, /RETRYABLE_RETRY_DELAY_MS/);
    const completeBlock = uploadSrc.slice(
      uploadSrc.indexOf('async function completeFile'),
      uploadSrc.indexOf('export async function uploadFilesToSession'),
    );
    const retryCalls = [...completeBlock.matchAll(/callUploadSession\(request\)/g)];
    assert.equal(retryCalls.length, 2, 'initial call + exactly one retry');
    assert.match(completeBlock, /return interpretCompletion\(result\)/);
    assert.doesNotMatch(completeBlock, /while\s*\(/);
  });

  it('a post-retry 503 still reports failed, never uploaded', () => {
    const out = interpretCompletion({
      status: 503,
      payload: { error: 'Service unavailable', code: 'unavailable' },
    });
    assert.equal(out.status, UPLOAD_FILE_STATUS.FAILED);
    assert.notEqual(out.status, UPLOAD_FILE_STATUS.UPLOADED);
    assert.notEqual(out.status, UPLOAD_FILE_STATUS.PENDING_RECONCILE);
  });
});
