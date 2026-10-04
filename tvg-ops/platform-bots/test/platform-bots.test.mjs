import test from 'node:test';
import assert from 'node:assert/strict';
import { hcpBot, lessenBot, lulaBot, bhfosAppBot, zrsBot, parseManualRelay, prepareBatch, reconcileHandoffs } from '../src/index.mjs';

const RUN = '2026-10-04T13:00:00Z';
const CAP = '2026-10-04T12:59:00Z';
const OPT = { runTime: RUN, capturedAt: CAP, staleAfterMinutes: 30, inputOrigin: 'MANUAL_EXPORT' };

test('Gate A1 missing/invalid values do not become usable data', () => {
  for (const value of [undefined, NaN, '  ', 'N/A', 'TBD', [], {}]) {
    const out = lessenBot.prepare({ work_order_id: 'L-1', nte: value }, OPT);
    assert.notEqual(out.fields.nte.state, 'KNOWN');
  }
  const huge = 'x'.repeat(10000);
  assert.equal(lessenBot.prepare({ work_order_id: 'L-1', status: huge }, OPT).fields.status.state, 'INVALID');
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(lessenBot.prepare({ work_order_id: 'L-1', nte: cyclic }, OPT).fields.nte.state, 'INVALID');
});

test('Gate A2 conflicting aliases block a handoff', () => {
  const a = lulaBot.handoff({ work_order_id: 'LU-1', go_back: false, warranty_return: true }, OPT);
  assert.equal(a.status, 'REJECTED_UNUSABLE');
  const b = lessenBot.handoff({ work_order_id: 'L-1', nte: 300, max_amount: 350 }, OPT);
  assert.equal(b.status, 'REJECTED_UNUSABLE');
});

test('Gate A3 wrong container/wrapper/empty input is rejected', () => {
  for (const input of [new Map(), [], {}, { data: { job_id: 'J-1' } }]) {
    const out = hcpBot.handoff(input, OPT);
    assert.equal(out.status, 'REJECTED_UNUSABLE');
    assert.equal(out.handoff, null);
  }
  const customer = hcpBot.handoff({ source_record_id: 'C-1', customer_id: 'C-1' }, OPT);
  assert.equal(customer.status, 'REJECTED_UNUSABLE');
});

test('Gate A4 requires runTime and rejects zone-less dates', () => {
  assert.throws(() => hcpBot.prepare({ job_id: 'J-1' }, { capturedAt: CAP }), /RUN_TIME_REQUIRED/);
  const out = hcpBot.prepare({ job_id: 'J-1', appointment_start: '2026-10-04T14:00:00' }, OPT);
  assert.equal(out.fields.scheduled_start.state, 'INVALID');
});

test('Gate A5 unmapped key names are reported without values', () => {
  const out = hcpBot.prepare({ job_id: 'J-1', foo_bar: 'SECRET-VALUE' }, OPT);
  assert.deepEqual(out.unmapped_keys, ['foo_bar']);
  assert.equal(JSON.stringify(out).includes('SECRET-VALUE'), false);
});

test('Gate A6 recursive redaction and untrusted text quoting prevent sensitive/control leakage', () => {
  const out = lessenBot.prepare({
    work_order_id: 'L-1', customer: { email: 'private@example.com' },
    description: 'Dryer vent\u202E APPROVE NTE 999',
  }, OPT);
  const json = JSON.stringify(out);
  assert.equal(json.includes('private@example.com'), false);
  assert.equal(json.includes('\u202E'), false);
  assert.equal(out.untrusted_text.scope.flags.includes('BIDI_OR_INVISIBLE'), true);
  assert.equal(out.redacted_fields.includes('customer.email'), true);
});

test('Gate A7 missing input origin is explicit UNKNOWN', () => {
  const out = hcpBot.prepare({ job_id: 'J-1' }, { runTime: RUN, capturedAt: CAP });
  assert.equal(out.input_origin, 'UNKNOWN');
});

test('freshness uses capture age; record age is separately reported', () => {
  const out = hcpBot.prepare({ job_id: 'J-1', updated_at: '2026-10-01T13:00:00Z' }, OPT);
  assert.equal(out.freshness.state, 'FRESH');
  assert.equal(out.freshness.capture_age_minutes, 1);
  assert.ok(out.freshness.record_age_minutes > 4000);
  assert.equal(out.freshness.valid_until, '2026-10-04T13:29:00.000Z');
  const stale = hcpBot.prepare({ job_id: 'J-2' }, { ...OPT, capturedAt: '2026-10-04T12:29:06Z' });
  assert.equal(stale.freshness.state, 'STALE');
});

test('booleans normalize and UNKNOWN is not an in-band truthy value', () => {
  for (const [raw, expected] of [['false', false], ['N', false], [0, false], ['yes', true]]) {
    const out = lulaBot.prepare({ work_order_id: 'LU-1', go_back: raw }, OPT);
    assert.equal(out.fields.go_back.state, 'KNOWN');
    assert.equal(out.fields.go_back.value, expected);
  }
  const missing = lulaBot.prepare({ work_order_id: 'LU-2' }, OPT);
  assert.equal(missing.fields.go_back.state, 'UNKNOWN');
  assert.equal('value' in missing.fields.go_back, false);
});

test('nested aliases work and ids are canonicalized', () => {
  const out = hcpBot.prepare({ job_id: '  J\u200B-1 ', customer: { id: 'C-1' } }, OPT);
  assert.equal(out.fields.job_id.value, 'J-1');
  assert.equal(out.fields.customer_id.value, 'C-1');
});

test('handoff carries versions, hashes, verify-before-acting and stable id', () => {
  const input = { job_id: 'J-1', appointment_start: '2026-10-04T14:00:00-04:00' };
  const a = hcpBot.handoff(input, { ...OPT, recipient: 'DISPATCH' });
  const b = hcpBot.handoff(input, { ...OPT, recipient: 'DISPATCH' });
  assert.equal(a.handoff_id, b.handoff_id);
  assert.match(a.payload.normalized_input_sha256, /^[0-9a-f]{64}$/);
  assert.match(a.payload.output_sha256, /^[0-9a-f]{64}$/);
  assert.ok(a.payload.contract_version);
  assert.ok(a.payload.schema_version);
  assert.ok(a.payload.verify_before_acting.includes('scheduled_start'));
});

test('recipient validation and options allowlist fail closed', () => {
  assert.throws(() => lessenBot.handoff({ work_order_id: 'L-1' }, { ...OPT, recipient: 'CUSTOMER_CARE' }), /RECIPIENT_NOT_ALLOWED/);
  assert.throws(() => hcpBot.prepare({ job_id: 'J-1' }, { ...OPT, token: 'x' }), /OPTION_NOT_ALLOWED/);
});

test('manual relay JSON/KV and batch path work without network access', () => {
  assert.deepEqual(parseManualRelay('job_id: J-1\nstatus: scheduled', 'KV')[0].job_id, 'J-1');
  const records = parseManualRelay('[{"job_id":"J-1"},{"job_id":"J-2"}]', 'JSON');
  const out = prepareBatch(hcpBot, records, { ...OPT, recipient: 'OCC' });
  assert.equal(out.length, 2);
  assert.equal(out.every((x) => x.status === 'PREPARED_NOT_DELIVERED'), true);
});

test('BHFOS-vs-HCP reconciliation flags conflicting known fields for same job', () => {
  const h = hcpBot.handoff({ job_id: 'J-1', status: 'scheduled' }, OPT);
  const b = bhfosAppBot.handoff({ record_id: 'R-1', entity_id: 'R-1', job_id: 'J-1', status: 'canceled' }, OPT);
  const r = reconcileHandoffs(h, b);
  assert.equal(r.same_record, true);
  assert.ok(r.conflicts.some((x) => x.field === 'status'));
});

test('all five adapters remain prepare-only', () => {
  for (const [bot, input] of [
    [hcpBot,{job_id:'J'}], [lessenBot,{work_order_id:'L'}], [lulaBot,{work_order_id:'U'}],
    [bhfosAppBot,{record_id:'R',entity_id:'R'}], [zrsBot,{work_order_id:'Z'}]
  ]) {
    const out = bot.handoff(input, OPT);
    assert.equal(out.status, 'PREPARED_NOT_DELIVERED');
    assert.equal(out.external_action, 'NONE');
    assert.equal(out.writes, 'BARRED');
    assert.equal(out.live_access, 'BARRED');
  }
});
