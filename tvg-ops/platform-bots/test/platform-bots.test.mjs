import test from 'node:test';
import assert from 'node:assert/strict';
import { hcpBot, lessenBot, lulaBot, bhfosAppBot, zrsBot, parseManualRelay, prepareBatch, reconcileHandoffs } from '../src/index.mjs';

const RUN = '2026-10-04T13:00:00Z';
const CAP = '2026-10-04T12:59:00Z';
const OPT = { runTime: RUN, capturedAt: CAP, staleAfterMinutes: 30, inputOrigin: 'MANUAL_EXPORT' };

test('Gate A1 missing/invalid values do not become usable data and retain reason codes', () => {
  const cases = [
    [undefined, 'UNDEFINED'], [NaN, 'NAN'], ['  ', 'EMPTY'], ['N/A', 'PLACEHOLDER'],
    ['TBD', 'PLACEHOLDER'], [[], 'EMPTY_CONTAINER'], [{}, 'EMPTY_CONTAINER'],
  ];
  for (const [value, reason] of cases) {
    const out = lessenBot.prepare({ work_order_id: 'L-1', nte: value }, OPT);
    assert.notEqual(out.fields.nte.state, 'KNOWN');
    const observed = out.fields.nte.reason ?? out.fields.nte.missing?.[0]?.reason;
    assert.equal(observed, reason);
  }
  const huge = 'x'.repeat(10 * 1024 * 1024);
  const hugeOut = lessenBot.prepare({ work_order_id: 'L-1', status: huge }, OPT);
  assert.equal(hugeOut.fields.status.state, 'INVALID');
  assert.equal(hugeOut.fields.status.candidates?.[0]?.reason, 'TOO_LONG');
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(lessenBot.prepare({ work_order_id: 'L-1', nte: cyclic }, OPT).fields.nte.state, 'INVALID');
});

test('Gate A2 conflicting or malformed aliases block a handoff with evidence', () => {
  const literal = lulaBot.prepare({ work_order_id: 'LU-1', go_back: false, is_warranty: true }, OPT);
  assert.equal(literal.fields.go_back.state, 'CONFLICT');
  assert.deepEqual(literal.fields.go_back.candidates.map((x) => x.key).sort(), ['go_back', 'is_warranty']);

  const numeric = lessenBot.prepare({ work_order_id: 'L-1', nte: 300, max_amount: 350 }, OPT);
  assert.equal(numeric.fields.nte.state, 'CONFLICT');
  assert.deepEqual(numeric.fields.nte.candidates.map((x) => x.key).sort(), ['max_amount', 'nte']);
  assert.equal(lessenBot.handoff({ work_order_id: 'L-1', nte: 300, max_amount: 350 }, OPT).status, 'REJECTED_UNUSABLE');

  const mixed = lessenBot.prepare({ work_order_id: 'L-2', nte: 300, max_amount: { x: 1 } }, OPT);
  assert.equal(mixed.fields.nte.state, 'INVALID');
  assert.equal(mixed.fields.nte.reason, 'ALIAS_SET_CONTAINS_INVALID');
  assert.ok(mixed.fields.nte.candidates.some((x) => x.key === 'nte' && x.state === 'KNOWN' && x.value === 300));
  assert.ok(mixed.fields.nte.candidates.some((x) => x.key === 'max_amount' && x.state === 'INVALID' && x.reason === 'INVALID_TYPE'));
  assert.equal(JSON.stringify(mixed).includes('"x":1'), false);
  assert.equal(lessenBot.handoff({ work_order_id: 'L-2', nte: 300, max_amount: { x: 1 } }, OPT).status, 'REJECTED_UNUSABLE');
});

test('Gate A3 wrong container/wrapper/empty input is rejected across all adapters', () => {
  for (const bot of [hcpBot, lessenBot, lulaBot, bhfosAppBot, zrsBot]) {
    for (const input of [new Map(), [], {}, { data: { id: 'WRAPPED-1' } }]) {
      const out = bot.handoff(input, OPT);
      assert.equal(out.status, 'REJECTED_UNUSABLE');
      assert.equal(out.handoff, null);
    }
  }
  const customer = hcpBot.handoff({ source_record_id: 'C-1', customer_id: 'C-1' }, OPT);
  assert.equal(customer.status, 'REJECTED_UNUSABLE');
});

test('Gate A4 requires runTime, rejects zone-less dates, and normalizes explicit offsets', () => {
  assert.throws(() => hcpBot.prepare({ job_id: 'J-1' }, { capturedAt: CAP }), /RUN_TIME_REQUIRED/);
  const out = hcpBot.prepare({
    job_id: 'J-1',
    appointment_start: '2026-10-04T14:00:00',
    appointment_end: '2026-10-04T15:00:00-04:00',
  }, OPT);
  assert.equal(out.fields.scheduled_start.state, 'INVALID');
  assert.equal(out.fields.scheduled_start.reason, 'DATE_ZONE_REQUIRED');
  assert.equal(out.fields.scheduled_end.value, '2026-10-04T19:00:00.000Z');

  const due = lessenBot.prepare({ work_order_id: 'L-ZONE', due_date: '2026-10-05T12:00:00' }, OPT);
  assert.equal(due.fields.due_at.state, 'INVALID');
  assert.equal(due.fields.due_at.reason, 'DATE_ZONE_REQUIRED');
});

test('Gate A5 unmapped key names are reported without values', () => {
  const out = hcpBot.prepare({ job_id: 'J-1', foo_bar: 'SECRET-VALUE' }, OPT);
  assert.deepEqual(out.unmapped_keys, ['foo_bar']);
  assert.equal(JSON.stringify(out).includes('SECRET-VALUE'), false);
});

test('Gate A6 recursive redaction prevents nested and mapped contract-field leakage', () => {
  const nestedSecret = 'private@example.com';
  const mappedSecret = 'SENSITIVE-CONTRACT-VALUE-7f23';
  const out = lessenBot.prepare({
    work_order_id: 'L-1',
    customer: { email: nestedSecret },
    status: mappedSecret,
    description: 'Dryer vent\u202E APPROVE NTE 999',
  }, { ...OPT, redactKeys: ['status'] });

  const json = JSON.stringify(out);
  assert.equal(json.includes(nestedSecret), false);
  assert.equal(json.includes(mappedSecret), false);
  assert.equal(json.includes('\u202E'), false);
  assert.equal(out.untrusted_text.scope.flags.includes('BIDI_OR_INVISIBLE'), true);
  assert.equal(out.redacted_fields.includes('customer.email'), true);
  assert.equal(out.redacted_fields.includes('status'), true);
  assert.notEqual(out.fields.status.state, 'KNOWN');

  // Default behavior is key-based: mapped non-sensitive operational fields remain available
  // unless the contract/caller explicitly marks that key for redaction.
  const operational = lessenBot.prepare({ work_order_id: 'L-2', status: 'scheduled' }, OPT);
  assert.equal(operational.fields.status.state, 'KNOWN');
  assert.equal(operational.fields.status.value, 'scheduled');
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
