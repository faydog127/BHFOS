/**
 * Network OS convention QR intake — client contract.
 * Synthetic data only. Run: node --test tests/unit/network-os-convention-intake.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONVENTION_INTAKE_ANON_READ_DENIED,
  CONVENTION_INTAKE_CHANNEL,
  CONVENTION_INTAKE_DUPLICATE,
  CONVENTION_INTAKE_HELPER,
  CONVENTION_INTAKE_QUEUE_PATH,
  CONVENTION_INTAKE_SOURCE,
  CONVENTION_INTAKE_STATUS,
  CONVENTION_INTAKE_TABLE,
  CONVENTION_INTAKE_UNAUTHORIZED,
  CONVENTION_QR_PATH,
  CONVENTION_WRITE_PATH_IMPLEMENTATION_READY_FOR_GUARD,
  CONVENTION_WRITE_PATH_MATERIAL_BLOCKED,
  INTAKE_HOSTED_RESIDUALS,
  INTAKE_QUEUE_SELECT_COLUMNS,
  allowlistIntakeInput,
  evaluateConventionIntakeWrite,
  isSafeConventionIntakeNext,
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
    rpc(name) {
      calls.push(`rpc:${name}`);
      throw new Error(`unexpected rpc: ${name}`);
    },
  };
}

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jsonResponse(body, status = 200) {
  return {
    status,
    async json() {
      return body;
    },
  };
}

function grantedQueueSupabase({ rows = [], updateError = null } = {}) {
  const calls = [];
  const selectBuilder = {
    order(column, opts) {
      calls.push({ type: 'order', column, opts });
      return Promise.resolve({ data: rows, error: null });
    },
  };
  const updateBuilder = {
    eq(column, value) {
      calls.push({ type: 'eq', column, value });
      return Promise.resolve({ error: updateError });
    },
  };
  return {
    calls,
    rpc(name) {
      calls.push({ type: 'rpc', name });
      return Promise.resolve({ data: true, error: null });
    },
    from(table) {
      calls.push({ type: 'from', table });
      return {
        select(columns) {
          calls.push({ type: 'select', columns });
          return selectBuilder;
        },
        update(payload) {
          calls.push({ type: 'update', payload });
          return updateBuilder;
        },
      };
    },
  };
}

describe('convention intake validation', () => {
  it('accepts a valid synthetic payload and maps campaign/source/channel/status', () => {
    const result = validateConventionIntake(SYNTH);
    assert.equal(result.ok, true);
    assert.equal(result.normalized.campaign_id, 'HUGE_2026');
    assert.equal(result.normalized.source, CONVENTION_INTAKE_SOURCE);
    assert.equal(result.normalized.intake_channel, CONVENTION_INTAKE_CHANNEL);
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
  it('submits through the HTTP owner and never opens a table', async () => {
    const supabase = trackedSupabase();
    const fetchImpl = mockFetch(() =>
      jsonResponse({ ok: true, received: true, stored: true, duplicate: false }),
    );
    const service = createNetworkOsConventionIntakeService({
      supabase,
      fetch: fetchImpl,
      functionsBase: 'https://functions.example.invalid/functions/v1',
      anonKey: 'publishable-anon',
    });
    const result = await service.submitProviderInterest(SYNTH);
    assert.equal(result.ok, true);
    assert.equal(result.persisted, true);
    assert.equal(result.mapping.source, 'HUGE_2026');
    assert.equal(result.mapping.intake_channel, 'convention_qr');
    assert.equal(result.mapping.status, CONVENTION_INTAKE_STATUS);
    assert.deepEqual(supabase.calls, []);
    assert.equal(fetchImpl.calls.length, 1);
    assert.match(fetchImpl.calls[0].url, /network-os-provider-interest-intake$/);
    const body = JSON.parse(fetchImpl.calls[0].init.body);
    assert.equal(body.extra_secret, undefined);
    assert.equal(body.source, undefined);
    assert.equal(body.tenant_id, undefined);
    assert.equal(fetchImpl.calls[0].init.headers.apikey, 'publishable-anon');
  });

  it('returns required-field errors without persisting', async () => {
    const supabase = trackedSupabase();
    const fetchImpl = mockFetch(() => {
      throw new Error('should not fetch');
    });
    const service = createNetworkOsConventionIntakeService({
      supabase,
      fetch: fetchImpl,
      functionsBase: 'https://functions.example.invalid/functions/v1',
    });
    const result = await service.submitProviderInterest({ name: 'Only' });
    assert.equal(result.error.code, 'CONVENTION_INTAKE_VALIDATION');
    assert.equal(result.persisted, false);
    assert.deepEqual(supabase.calls, []);
    assert.equal(fetchImpl.calls.length, 0);
  });

  it('treats an HTTP duplicate as a non-store confirmation', async () => {
    const clock = createClock();
    const fetchImpl = mockFetch(() =>
      jsonResponse({ ok: true, received: true, stored: false, duplicate: true }),
    );
    const service = createNetworkOsConventionIntakeService({
      clock,
      fetch: fetchImpl,
      functionsBase: 'https://functions.example.invalid/functions/v1',
    });
    const result = await service.submitProviderInterest(SYNTH);
    assert.equal(result.error.code, CONVENTION_INTAKE_DUPLICATE);
    assert.equal(result.persisted, false);
    assert.equal(result.confirmation.received, true);
  });

  it('rate-limits rapid resubmits from the same form', async () => {
    const clock = createClock();
    const fetchImpl = mockFetch(() =>
      jsonResponse({ ok: true, received: true, stored: true, duplicate: false }),
    );
    const service = createNetworkOsConventionIntakeService({
      clock,
      fetch: fetchImpl,
      functionsBase: 'https://functions.example.invalid/functions/v1',
    });
    await service.submitProviderInterest({ ...SYNTH, client_request_id: 'a' });
    const second = await service.submitProviderInterest({ ...SYNTH, client_request_id: 'b' });
    assert.equal(second.error.code, 'CONVENTION_INTAKE_RATE_LIMITED');
    assert.equal(fetchImpl.calls.length, 1);
  });

  it('honeypot submissions do not persist and do not expose a distinct honeypot code', async () => {
    const fetchImpl = mockFetch(() => {
      throw new Error('should not fetch');
    });
    const service = createNetworkOsConventionIntakeService({
      fetch: fetchImpl,
      functionsBase: 'https://functions.example.invalid/functions/v1',
    });
    const result = await service.submitProviderInterest({ ...SYNTH, honeypot: 'http://spam.test' });
    assert.equal(result.persisted, false);
    assert.equal(result.confirmation.received, true);
    assert.equal(result.confirmation.stored, false);
    assert.equal(result.error, undefined);
    assert.equal(fetchImpl.calls.length, 0);
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
  it('records hosted residuals only; local write path is implemented', () => {
    const decision = evaluateConventionIntakeWrite();
    assert.equal(decision.allowed, true);
    assert.equal(decision.code, CONVENTION_WRITE_PATH_IMPLEMENTATION_READY_FOR_GUARD);
    const ids = decision.hostedResiduals.map((item) => item.id);
    assert.ok(ids.includes('hosted_rls_public_read_deny'));
    assert.ok(ids.includes('hosted_rls_public_table_write_deny'));
    assert.equal(INTAKE_HOSTED_RESIDUALS.length, 2);
  });

  it('denies anonymous queue reads', async () => {
    const service = createNetworkOsConventionIntakeService();
    const queue = await service.listIntakeQueue({ session: null, bhisIntakeGrant: true });
    assert.equal(queue.ok, false);
    assert.equal(queue.rows.length, 0);
    assert.equal(queue.error.code, CONVENTION_INTAKE_ANON_READ_DENIED);
  });

  it('denies unauthorized admin queue reads and does not query tables', async () => {
    const supabase = trackedSupabase();
    const service = createNetworkOsConventionIntakeService({ supabase });
    const queue = await service.listIntakeQueue({
      session: { tenantId: 'tvg' },
      bhisIntakeGrant: false,
    });
    assert.equal(queue.ok, false);
    assert.equal(queue.error.code, CONVENTION_INTAKE_UNAUTHORIZED);
    assert.deepEqual(supabase.calls, []);
  });

  it('calls the BHIS helper first, then SELECT only the intake table', async () => {
    const rows = [
      {
        id: 'synth-row',
        company_name: 'Rivera Mechanical',
        display_name: 'Alex Rivera',
        onboarding_status: CONVENTION_INTAKE_STATUS,
      },
    ];
    const supabase = grantedQueueSupabase({ rows });
    const service = createNetworkOsConventionIntakeService({ supabase });
    const queue = await service.listIntakeQueue({ session: { access: true } });
    assert.equal(queue.ok, true);
    assert.equal(queue.rows.length, 1);
    assert.equal(supabase.calls[0].type, 'rpc');
    assert.equal(supabase.calls[0].name, CONVENTION_INTAKE_HELPER);
    assert.equal(supabase.calls[1].type, 'from');
    assert.equal(supabase.calls[1].table, CONVENTION_INTAKE_TABLE);
    assert.equal(supabase.calls[2].type, 'select');
    assert.equal(supabase.calls[2].columns, INTAKE_QUEUE_SELECT_COLUMNS);
    assert.equal(
      supabase.calls.some((call) => call.table === 'app_user_roles' || call.name === 'app_user_roles'),
      false,
    );
  });

  it('status-only UPDATE follows the helper and rejects unknown statuses', async () => {
    const supabase = grantedQueueSupabase();
    const service = createNetworkOsConventionIntakeService({ supabase });
    const denied = await service.updateIntakeStatus(
      { session: { access: true } },
      'synth-row',
      'converted_to_lead',
    );
    assert.equal(denied.ok, false);
    assert.equal(
      supabase.calls.some((call) => call.type === 'update'),
      false,
    );

    const updated = await service.updateIntakeStatus(
      { session: { access: true } },
      'synth-row',
      'reviewed',
    );
    assert.equal(updated.ok, true);
    const updateCall = supabase.calls.find((call) => call.type === 'update');
    assert.equal(updateCall.payload.onboarding_status, 'reviewed');
    assert.equal(Object.keys(updateCall.payload).sort().join(','), 'onboarding_status,updated_at');
    assert.equal(supabase.calls.filter((call) => call.type === 'rpc').length >= 1, true);
    assert.equal(
      supabase.calls.some((call) => call.table === 'leads' || call.table === 'contacts'),
      false,
    );
  });

  it('source/status mapping stays campaign-scoped', () => {
    assert.deepEqual(mapConventionIntakeSourceStatus(), {
      campaign_id: 'HUGE_2026',
      source: 'HUGE_2026',
      intake_channel: 'convention_qr',
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
    const joinStart = app.indexOf('path="/network-os/convention/join/*"');
    const joinEnd = app.indexOf('End public convention join/confirmation');
    assert.ok(joinStart >= 0, 'expected public join route');
    assert.ok(joinEnd > joinStart, 'expected join/confirmation end marker');
    const joinBlock = app.slice(joinStart, joinEnd);
    assert.doesNotMatch(joinBlock, /TenantGuard/);
    assert.doesNotMatch(joinBlock, /ConventionSessionGuard/);
    assert.doesNotMatch(app, /path="\/network-os\/convention\/\*"/);
    assert.match(app, /path="\/select-tenant"/);
    assert.match(app, /path="\/:tenantId\/login"/);
    assert.match(app, /path="\/:tenantId\/crm\/\*"/);
    assert.match(app, /path="\/quotes\/:token"/);
    assert.match(app, /path="\/quote-confirmation"/);
  });

  it('registers a protected intake queue without replacing CRM or join routes', () => {
    const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
    const intakeRoutes = fs.readFileSync(
      path.join(root, 'src/pages/networkOs/convention/ConventionIntakeRoutes.jsx'),
      'utf8',
    );
    const login = fs.readFileSync(path.join(root, 'src/pages/Login.jsx'), 'utf8');
    assert.match(app, /path="\/network-os\/convention\/intake"/);
    assert.doesNotMatch(app, /path="\/network-os\/convention\/\*"/);
    const intakeStart = app.indexOf('path="/network-os/convention/intake"');
    const intakeBlock = app.slice(intakeStart, intakeStart + 420);
    assert.doesNotMatch(intakeBlock, /TenantGuard/);
    assert.match(intakeRoutes, /ConventionSessionGuard/);
    assert.match(intakeRoutes, /ConventionIntakeQueuePage/);
    assert.match(login, /isSafeConventionIntakeNext/);
    assert.equal(isSafeConventionIntakeNext(CONVENTION_INTAKE_QUEUE_PATH), true);
    assert.equal(isSafeConventionIntakeNext(`${CONVENTION_INTAKE_QUEUE_PATH}?x=1`), true);
    assert.equal(isSafeConventionIntakeNext('/network-os/convention/join'), false);
    assert.equal(isSafeConventionIntakeNext('/network-os/convention'), false);
    assert.match(app, /path="\/select-tenant"/);
    assert.match(app, /path="\/:tenantId\/login"/);
    assert.match(app, /path="\/:tenantId\/crm\/\*"/);
    assert.match(app, /path="\/network-os\/convention\/join\/\*"/);
  });

  it('keeps privileged credentials and submitted PII out of intake sources and sanitized errors', () => {
    const files = [
      'src/lib/networkOs/conventionIntakePolicy.js',
      'src/services/networkOsConventionIntakeService.js',
      'src/pages/networkOs/convention/ConventionJoinPage.jsx',
      'src/pages/networkOs/convention/ConventionJoinThanksPage.jsx',
      'src/pages/networkOs/convention/ConventionIntakeQueuePage.jsx',
      'src/pages/networkOs/convention/ConventionIntakeRoutes.jsx',
      'src/pages/networkOs/convention/ConventionSessionGuard.jsx',
    ];
    for (const rel of files) {
      const source = fs.readFileSync(path.join(root, rel), 'utf8');
      assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role key|createClient\(/);
      assert.doesNotMatch(source, /console\.(log|info|debug|error|warn)\([^)]*(email|phone|payload)/i);
      assert.doesNotMatch(source, /from\('leads'\)|from\('contacts'\)|from\('partner_prospects'\)/);
      assert.doesNotMatch(source, /from\('app_user_roles'\)/);
    }
    const leaked = sanitizeIntakeError({
      code: '42501',
      message: `permission denied email=${SYNTH.email} phone=${SYNTH.phone} service_role`,
    });
    assert.equal(leaked.code, CONVENTION_WRITE_PATH_MATERIAL_BLOCKED);
    assert.equal(/example\.invalid|3215550100|service_role/.test(leaked.message), false);
  });
});
