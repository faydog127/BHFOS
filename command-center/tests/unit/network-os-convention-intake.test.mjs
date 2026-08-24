/**
 * Network OS convention QR intake — fail-closed write path.
 * Synthetic data only. Run: node --test tests/unit/network-os-convention-intake.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONVENTION_INTAKE_ANON_READ_DENIED,
  CONVENTION_INTAKE_DUPLICATE,
  CONVENTION_INTAKE_SOURCE,
  CONVENTION_INTAKE_STATUS,
  CONVENTION_INTAKE_UNAUTHORIZED,
  CONVENTION_QR_PATH,
  CONVENTION_WRITE_PATH_MATERIAL_BLOCKED,
  INTAKE_MISSING_REQUIREMENTS,
  allowlistIntakeInput,
  evaluateConventionIntakeWrite,
  mapConventionIntakeSourceStatus,
  resolveConventionQrTarget,
  sanitizeIntakeError,
  sanitizeNetworkFailure,
  validateConventionIntake,
} from '../../src/lib/networkOs/conventionIntakePolicy.js';
import { createNetworkOsConventionIntakeService } from '../../src/services/networkOsConventionIntakeService.js';
import { buildConventionQrDataUrl, conventionQrPayload } from '../../src/lib/networkOs/conventionQr.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SYNTH = Object.freeze({
  name: 'Alex Rivera',
  company: 'Rivera Mechanical',
  email: 'alex.rivera@example.invalid',
  phone: '3215550100',
  trades: ['HVAC'],
  service_area: 'Brevard County',
  consent: true,
  client_request_id: 'synth-req-1',
  extra_secret: 'should-drop',
});

function createClock(start = 1_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
    },
  };
}

function trackedSupabase() {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(table);
      throw new Error(`unexpected table access: ${table}`);
    },
  };
}

describe('convention intake validation', () => {
  it('accepts a valid synthetic payload and maps source/status', () => {
    const result = validateConventionIntake(SYNTH);
    assert.equal(result.ok, true);
    assert.equal(result.normalized.source, CONVENTION_INTAKE_SOURCE);
    assert.equal(result.normalized.status, CONVENTION_INTAKE_STATUS);
    assert.equal(result.normalized.phone, '3215550100');
  });

  it('requires name, company, email, phone, trades, service area, and consent', () => {
    const result = validateConventionIntake({});
    const fields = result.errors.map((item) => item.field).sort();
    assert.deepEqual(fields, [
      'company',
      'consent',
      'email',
      'name',
      'phone',
      'service_area',
      'trades',
    ]);
  });

  it('drops non-allowlisted fields', () => {
    const allowed = allowlistIntakeInput(SYNTH);
    assert.equal(allowed.extra_secret, undefined);
    assert.equal(allowed.email, SYNTH.email);
  });
});

describe('convention intake persistence', () => {
  it('never writes a valid submission and never opens a table', async () => {
    const supabase = trackedSupabase();
    const service = createNetworkOsConventionIntakeService({ supabase });
    const result = await service.submitProviderInterest(SYNTH);
    assert.equal(result.ok, false);
    assert.equal(result.persisted, false);
    assert.equal(result.error.code, CONVENTION_WRITE_PATH_MATERIAL_BLOCKED);
    assert.equal(result.mapping.source, CONVENTION_INTAKE_SOURCE);
    assert.equal(result.mapping.status, CONVENTION_INTAKE_STATUS);
    assert.deepEqual(supabase.calls, []);
  });

  it('returns required-field errors without persisting', async () => {
    const supabase = trackedSupabase();
    const service = createNetworkOsConventionIntakeService({ supabase });
    const result = await service.submitProviderInterest({ name: 'Only' });
    assert.equal(result.error.code, 'CONVENTION_INTAKE_VALIDATION');
    assert.equal(result.persisted, false);
    assert.deepEqual(supabase.calls, []);
  });

  it('treats a repeated client_request_id as a duplicate after the rate window', async () => {
    const clock = createClock();
    const service = createNetworkOsConventionIntakeService({ clock });
    const first = await service.submitProviderInterest(SYNTH);
    assert.equal(first.error.code, CONVENTION_WRITE_PATH_MATERIAL_BLOCKED);
    clock.advance(10_000);
    const second = await service.submitProviderInterest(SYNTH);
    assert.equal(second.error.code, CONVENTION_INTAKE_DUPLICATE);
    assert.equal(second.persisted, false);
  });

  it('rate-limits rapid resubmits from the same form', async () => {
    const clock = createClock();
    const service = createNetworkOsConventionIntakeService({ clock });
    await service.submitProviderInterest({ ...SYNTH, client_request_id: 'a' });
    const second = await service.submitProviderInterest({ ...SYNTH, client_request_id: 'b' });
    assert.equal(second.error.code, 'CONVENTION_INTAKE_RATE_LIMITED');
  });

  it('honeypot submissions do not persist and do not expose a distinct success payload', async () => {
    const service = createNetworkOsConventionIntakeService();
    const result = await service.submitProviderInterest({ ...SYNTH, honeypot: 'http://spam.test' });
    assert.equal(result.persisted, false);
    assert.equal(result.error.code, CONVENTION_WRITE_PATH_MATERIAL_BLOCKED);
  });

  it('maps refresh/back of the same request to a non-write confirmation', async () => {
    const clock = createClock();
    const service = createNetworkOsConventionIntakeService({ clock });
    await service.submitProviderInterest(SYNTH);
    clock.advance(10_000);
    const replay = await service.submitProviderInterest(SYNTH);
    assert.equal(replay.confirmation.received, true);
    assert.equal(replay.confirmation.stored, false);
    assert.equal(replay.persisted, false);
  });

  it('sanitizes network failure without echoing PII', () => {
    const service = createNetworkOsConventionIntakeService();
    const result = service.handleNetworkFailure({
      message: `fetch failed for ${SYNTH.email} ${SYNTH.phone}`,
    });
    assert.equal(result.persisted, false);
    assert.equal(result.error.code, 'CONVENTION_INTAKE_NETWORK');
    assert.equal(result.error.message.includes(SYNTH.email), false);
    assert.equal(result.error.message.includes(SYNTH.phone), false);
    const sanitized = sanitizeNetworkFailure();
    assert.equal(/example\.invalid|3215550100/.test(sanitized.message), false);
  });
});

describe('convention intake isolation', () => {
  it('records the exact missing schema and policy requirements', () => {
    const decision = evaluateConventionIntakeWrite();
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, CONVENTION_WRITE_PATH_MATERIAL_BLOCKED);
    const ids = decision.missing.map((item) => item.id);
    assert.ok(ids.includes('isolated_intake_object'));
    assert.ok(ids.includes('hosted_rls_public_read_deny'));
    assert.ok(ids.includes('hosted_rls_public_table_write_deny'));
    assert.ok(ids.includes('server_write_owner'));
    assert.ok(ids.includes('duplicate_key'));
    assert.ok(ids.includes('bhis_queue_grant'));
    assert.equal(INTAKE_MISSING_REQUIREMENTS.length, 6);
  });

  it('denies anonymous queue reads', () => {
    const service = createNetworkOsConventionIntakeService();
    const queue = service.listIntakeQueue({ session: null, bhisIntakeGrant: true });
    assert.equal(queue.ok, false);
    assert.equal(queue.rows.length, 0);
    assert.equal(queue.error.code, CONVENTION_INTAKE_ANON_READ_DENIED);
  });

  it('denies unauthorized admin queue reads and does not query tables', () => {
    const supabase = trackedSupabase();
    const service = createNetworkOsConventionIntakeService({ supabase });
    const queue = service.listIntakeQueue({
      session: { tenantId: 'tvg' },
      bhisIntakeGrant: false,
    });
    assert.equal(queue.ok, false);
    assert.equal(queue.error.code, CONVENTION_INTAKE_UNAUTHORIZED);
    assert.deepEqual(supabase.calls, []);
  });

  it('source/status mapping stays convention-scoped', () => {
    assert.deepEqual(mapConventionIntakeSourceStatus(), {
      source: 'convention_qr',
      status: 'provider_interest_received',
    });
  });
});

describe('convention QR and secret hygiene', () => {
  it('builds a deterministic QR payload and image for the public join path', async () => {
    const origin = 'https://convention.example.invalid';
    assert.equal(resolveConventionQrTarget(origin), `${origin}${CONVENTION_QR_PATH}`);
    const first = await buildConventionQrDataUrl(origin);
    const second = await buildConventionQrDataUrl(origin);
    assert.equal(first, second);
    assert.match(first, /^data:image\/png;base64,/);
    assert.equal(conventionQrPayload(origin).includes('/network-os/convention/join'), true);
  });

  it('registers a public join route and does not place it behind TenantGuard', () => {
    const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
    assert.match(app, /path="\/network-os\/convention\/join\/\*"/);
    const joinBlock = app.slice(
      app.indexOf('path="/network-os/convention/join/*"'),
      app.indexOf('path="/network-os/convention/*"'),
    );
    assert.doesNotMatch(joinBlock, /TenantGuard/);
    assert.doesNotMatch(joinBlock, /ConventionSessionGuard/);
  });

  it('keeps service-role secrets and submitted PII out of intake sources and sanitized errors', () => {
    const files = [
      'src/lib/networkOs/conventionIntakePolicy.js',
      'src/services/networkOsConventionIntakeService.js',
      'src/pages/networkOs/convention/ConventionJoinPage.jsx',
      'src/pages/networkOs/convention/ConventionJoinThanksPage.jsx',
      'src/pages/networkOs/convention/ConventionIntakeQueuePage.jsx',
    ];
    for (const rel of files) {
      const source = fs.readFileSync(path.join(root, rel), 'utf8');
      assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role key|createClient\(/);
      assert.doesNotMatch(source, /console\.(log|info|debug|error|warn)\([^)]*(email|phone|payload)/i);
      assert.doesNotMatch(source, /from\('leads'\)|from\('contacts'\)|from\('partner_prospects'\)/);
    }
    const leaked = sanitizeIntakeError({
      code: '42501',
      message: `permission denied email=${SYNTH.email} phone=${SYNTH.phone} service_role`,
    });
    assert.equal(leaked.code, CONVENTION_WRITE_PATH_MATERIAL_BLOCKED);
    assert.equal(/example\.invalid|3215550100|service_role/.test(leaked.message), false);
  });
});
