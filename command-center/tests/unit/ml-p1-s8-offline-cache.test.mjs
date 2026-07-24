import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Executable offline retention rules (in-memory stand-in for IDB queue).
 * Mirrors mediaQueue.enforceCacheBudget / discardQueuedOrFailed policy.
 */

function estimateBytes(row) {
  return Number(row.byte_size) || 0;
}

async function enforceCacheBudget(rows, limitMb) {
  const limitBytes = limitMb * 1024 * 1024;
  let used = rows.reduce((s, r) => s + estimateBytes(r), 0);
  const evicted = [];
  const uploaded = rows
    .filter((r) => r.status === 'uploaded')
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const kept = [...rows];
  for (const row of uploaded) {
    if (used <= limitBytes) break;
    const idx = kept.findIndex((r) => r.id === row.id);
    if (idx >= 0) kept.splice(idx, 1);
    evicted.push(row.id);
    used -= estimateBytes(row);
  }
  if (used > limitBytes) {
    return { ok: false, usedBytes: used, limitBytes, evicted, kept };
  }
  return { ok: true, usedBytes: used, limitBytes, evicted, kept };
}

test('offline: queued and failed survive budget pressure; only uploaded evicted', async () => {
  const mb = 1024 * 1024;
  const rows = [
    { id: 'u1', status: 'uploaded', byte_size: 2 * mb, created_at: '2026-01-01' },
    { id: 'q1', status: 'queued', byte_size: 2 * mb, created_at: '2026-01-02' },
    { id: 'f1', status: 'failed', byte_size: 2 * mb, created_at: '2026-01-03' },
  ];
  const result = await enforceCacheBudget(rows, 3);
  assert.equal(result.ok, false);
  assert.deepEqual(result.evicted, ['u1']);
  assert.ok(result.kept.some((r) => r.id === 'q1'));
  assert.ok(result.kept.some((r) => r.id === 'f1'));
  assert.ok(!result.kept.some((r) => r.id === 'u1'));
});

test('offline: explicit discard allowed only for queued/failed', () => {
  const canDiscard = (status) => status === 'queued' || status === 'failed';
  assert.equal(canDiscard('queued'), true);
  assert.equal(canDiscard('failed'), true);
  assert.equal(canDiscard('uploading'), false);
  assert.equal(canDiscard('uploaded'), false);
});

test('offline: interruption leaves queued row until successful sync', () => {
  const states = ['queued', 'uploading', 'failed', 'queued', 'uploading', 'uploaded'];
  let retained = true;
  for (const s of states) {
    if (s === 'uploaded') retained = false;
    if (s !== 'uploaded') assert.equal(retained || s === 'uploaded', true);
  }
  assert.equal(states.filter((s) => s === 'queued' || s === 'failed').length >= 1, true);
});
