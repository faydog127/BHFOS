import test from 'node:test';
import assert from 'node:assert/strict';
import { hcpBot, lessenBot, lulaBot, bhfosAppBot, zrsBot } from '../src/index.mjs';

const RUN = '2026-10-04T13:00:00Z';

test('HCP prepares a read-only normalized job/appointment handoff', () => {
  const out = hcpBot.handoff({
    job_id: 'HCP-1',
    customer_id: 'C-1',
    appointment_start: '2026-10-04T14:00:00Z',
    appointment_end: '2026-10-04T15:00:00Z',
    job_status: 'scheduled',
    invoice_total: 279,
    service_type: 'dryer vent',
    updated_at: '2026-10-04T12:50:00Z',
  }, { runTime: RUN, staleAfterMinutes: 30, recipient: 'DISPATCH' });

  assert.equal(out.platform, 'HOUSECALL_PRO');
  assert.equal(out.external_action, 'NONE');
  assert.equal(out.writes, 'BARRED');
  assert.equal(out.payload.freshness.state, 'FRESH');
  assert.equal(out.payload.data.total_amount, 279);
  assert.equal(out.payload.claims.live_connection_used, false);
});

test('Lessen preserves missing platform fields as UNKNOWN', () => {
  const out = lessenBot.prepare({
    work_order_id: 'L-1',
    description: 'Synthetic dryer vent work order',
    updated_at: '2026-10-04T12:55:00Z',
  }, { runTime: RUN, staleAfterMinutes: 30 });

  assert.equal(out.platform, 'LESSEN');
  assert.equal(out.data.nte, 'UNKNOWN');
  assert.ok(out.missing.includes('nte'));
  assert.equal(out.claims.exact_platform_schema_verified, false);
});

test('Lula carries a go-back/warranty signal when supplied', () => {
  const out = lulaBot.prepare({
    job_id: 'LU-1',
    work_description: 'Synthetic go-back',
    is_warranty: true,
    updated_at: '2026-10-04T12:59:00Z',
  }, { runTime: RUN, staleAfterMinutes: 30 });

  assert.equal(out.platform, 'LULA');
  assert.equal(out.data.go_back, true);
  assert.equal(out.authority.prepare, 'A1_PREPARE');
});

test('BHFOS App adapter prepares internal CRM records without claiming live access', () => {
  const out = bhfosAppBot.handoff({
    record_id: 'CRM-1',
    module: 'dispatch',
    record_type: 'appointment',
    job_id: 'JOB-1',
    state: 'scheduled',
    appointment_start: '2026-10-04T15:00:00Z',
    appointment_end: '2026-10-04T16:00:00Z',
    updated_at: '2026-10-04T12:58:00Z',
  }, { runTime: RUN, staleAfterMinutes: 30, recipient: 'DISPATCH' });

  assert.equal(out.platform, 'BHFOS_APP');
  assert.equal(out.payload.data.module, 'dispatch');
  assert.equal(out.payload.data.linked_job_id, 'JOB-1');
  assert.equal(out.payload.claims.live_connection_used, false);
  assert.equal(out.external_action, 'NONE');
});

test('ZRS adapter preserves property-service evidence and unknown integration assumptions', () => {
  const out = zrsBot.prepare({
    service_request_id: 'ZRS-1',
    community_name: 'Synthetic Community',
    unit: '2B',
    work_description: 'Synthetic air duct cleaning',
    max_amount: 325,
    request_status: 'approved',
    updated_at: '2026-10-04T12:57:00Z',
  }, { runTime: RUN, staleAfterMinutes: 30 });

  assert.equal(out.platform, 'ZRS');
  assert.equal(out.data.property_name, 'Synthetic Community');
  assert.equal(out.data.nte, 325);
  assert.equal(out.claims.exact_platform_schema_verified, false);
  assert.equal(out.claims.external_write_performed, false);
});

test('live/write options are structurally barred for every platform bot', () => {
  for (const bot of [hcpBot, lessenBot, lulaBot, bhfosAppBot, zrsBot]) {
    assert.throws(() => bot.prepare({ id: 'X' }, { token: 'secret' }), /LIVE_OR_WRITE_PATH_BARRED/);
  }
  assert.throws(() => lessenBot.prepare({ id: 'X' }, { write: true }), /LIVE_OR_WRITE_PATH_BARRED/);
  assert.throws(() => zrsBot.prepare({ id: 'X' }, { baseUrl: 'https:\/\/example.invalid' }), /LIVE_OR_WRITE_PATH_BARRED/);
});

test('sensitive address fields are minimized before normalization/provenance output', () => {
  const out = bhfosAppBot.prepare({
    id: 'CRM-2',
    updated_at: '2026-10-04T12:59:00Z',
    street_address: '123 Private St',
  }, { runTime: RUN, redactKeys: ['street_address'] });

  assert.equal(JSON.stringify(out).includes('123 Private St'), false);
});
