import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { computeIdentity, evaluateIntake } from '../lib/pass1-intake-logic.mjs';
import {
  DISABLED_BASE_URL,
  HOSTINGER_LIVE_HOST,
  MOCK_CASES,
  STUCK_REAL_UID,
  assertHostingerGetRequest,
  buildClosedHoldSql,
  buildMessageUrl,
  decideFetchedIntake,
  planWorkerRoute,
  renderMockHostingerResponse,
} from '../lib/pass1-hostinger-fetch.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mockBase = 'https://mock.staging.invalid/webhook-test/tvg/staging-mock/mail';
const settings = {
  hold_on_form_auth_failure: true,
  open_lead_statuses: ['new', 'contacted', 'qualified', 'escalated'],
  hostinger_mail_api_base_url: mockBase,
  hostinger_mail_api_allowed_hosts: ['mock.staging.invalid'],
  hostinger_live_fetch_enabled: false,
  hostinger_fetch_timeout_ms: 8000,
  hostinger_fetch_max_body_bytes: 262144,
};

function queue(uid, extra = {}) {
  return {
    id: '30000000-0000-4000-8000-000000000099',
    mailbox: 'info@vent-guys.com',
    mailbox_resource_id: 'mbx_mock',
    folder: 'INBOX',
    uid: String(uid),
    hostinger_pointers: {
      mailbox_resource_id: 'mbx_mock',
      folder: 'INBOX',
      uid: String(uid),
      source: 'fast_ack_normalized',
    },
    ...extra,
  };
}

function httpItem(rendered) {
  if (rendered.timeout) return { error: { message: 'timeout of 8000ms exceeded' } };
  return { statusCode: rendered.http_status, body: JSON.stringify(rendered.response_body) };
}

function decide(uid, settingOverride = settings) {
  const plan = planWorkerRoute({
    queueRow: queue(uid),
    settings: settingOverride,
    filterRows: [],
    formSenders: [],
    contacts: [],
    leads: [],
  });
  const decided = decideFetchedIntake({
    plan,
    metadataItem: httpItem(renderMockHostingerResponse({ uid, kind: 'metadata' })),
    textItem: httpItem(renderMockHostingerResponse({ uid, kind: 'text' })),
    sourceItem: httpItem(renderMockHostingerResponse({ uid, kind: 'source' })),
  });
  return { plan, decided };
}

test('GET guard rejects other methods, other paths, and the live host by default', () => {
  const base = mockBase;
  const allowed = ['mock.staging.invalid'];
  const good = assertHostingerGetRequest({
    method: 'GET',
    url: `${base}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001/source`,
    baseUrl: base,
    allowedHosts: allowed,
    liveFetchEnabled: false,
  });
  assert.equal(good.ok, true);
  assert.equal(assertHostingerGetRequest({
    method: 'POST',
    url: `${base}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001`,
    baseUrl: base,
    allowedHosts: allowed,
    liveFetchEnabled: false,
  }).reason, 'method_rejected');
  assert.equal(assertHostingerGetRequest({
    method: 'GET',
    url: `${base}/api/v1/mailboxes/mbx_mock/send`,
    baseUrl: base,
    allowedHosts: allowed,
    liveFetchEnabled: false,
  }).reason, 'path_rejected');
  assert.equal(assertHostingerGetRequest({
    method: 'DELETE',
    url: `${base}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/1`,
    baseUrl: base,
    allowedHosts: allowed,
    liveFetchEnabled: false,
  }).reason, 'method_rejected');
  const liveUrl = `https://${HOSTINGER_LIVE_HOST}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/1/text`;
  assert.equal(assertHostingerGetRequest({
    method: 'GET',
    url: liveUrl,
    baseUrl: `https://${HOSTINGER_LIVE_HOST}`,
    allowedHosts: [HOSTINGER_LIVE_HOST],
    liveFetchEnabled: false,
  }).reason, 'live_fetch_disabled');
  assert.equal(assertHostingerGetRequest({
    method: 'GET',
    url: liveUrl,
    baseUrl: `https://${HOSTINGER_LIVE_HOST}`,
    allowedHosts: [HOSTINGER_LIVE_HOST],
    liveFetchEnabled: true,
  }).ok, true);
  assert.equal(assertHostingerGetRequest({
    method: 'GET',
    url: 'https://evil.example/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/1',
    baseUrl: 'https://evil.example',
    allowedHosts: allowed,
    liveFetchEnabled: true,
  }).reason, 'host_rejected');
});

test('real-fetch mock cases fail closed or follow the approved identity rule', () => {
  const happy = decide(910001);
  assert.equal(happy.plan.route, 'fetch');
  assert.equal(happy.plan.fetch_base_url, mockBase);
  assert.equal(
    happy.plan.metadata_url,
    `${mockBase}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001`,
  );
  assert.equal(
    happy.plan.text_url,
    `${mockBase}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001/text`,
  );
  assert.equal(
    happy.plan.source_url,
    `${mockBase}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001/source`,
  );
  assert.equal(happy.decided.decision.event_status, 'awaiting_pass2');
  assert.match(happy.decided.sql, /fetch_base_url/);
  assert.match(happy.decided.sql, /email_automation\.email_events/);
  assert.doesNotMatch(happy.decided.sql, /email_responses|email_send_queue|insert into public/i);

  const missing = decide(910404);
  assert.equal(missing.decided.decision.hold_reason, 'message_moved_uncertain');
  assert.equal(missing.decided.decision.queue_status, 'held');
  assert.doesNotMatch(missing.decided.sql, /INSERT INTO email_automation\.email_events/);

  const upstream = decide(910500);
  assert.equal(upstream.decided.decision.queue_status, 'error');
  assert.equal(upstream.decided.decision.hold_reason, 'hostinger_upstream_error');
  assert.doesNotMatch(upstream.decided.sql, /INSERT INTO email_automation\.email_events/);

  const timeout = decide(910408);
  assert.equal(timeout.decided.decision.hold_reason, 'hostinger_timeout');
  assert.equal(timeout.decided.decision.queue_status, 'error');

  const noAuth = decide(910601);
  assert.equal(noAuth.decided.decision.hold_reason, 'identity_uncertain');
  assert.equal(noAuth.decided.decision.event_status, 'held');
  assert.match(noAuth.decided.sql, /INSERT INTO email_automation\.email_events/);

  const noId = decide(910602);
  assert.equal(noId.decided.decision.event_status, 'awaiting_pass2');
  assert.match(noId.decided.sql, /fallback_hash/);
  assert.match(noId.decided.sql, /message_id = NULL/);

  const oversized = decide(910603);
  assert.equal(oversized.decided.decision.hold_reason, 'hostinger_body_too_large');
  assert.doesNotMatch(oversized.decided.sql, /INSERT INTO email_automation\.email_events/);
  assert.equal(Object.keys(MOCK_CASES).length, 7);
});

test('disabled base URL and unresolved pointers do not build a request', () => {
  const disabled = planWorkerRoute({ queueRow: queue(910001), settings: { hold_on_form_auth_failure: true } });
  assert.equal(disabled.route, 'hold');
  assert.equal(disabled.hold_reason, 'hostinger_fetch_disabled');
  assert.equal(disabled.fetch_base_url, DISABLED_BASE_URL);
  assert.equal(disabled.metadata_url, null);

  const mismatch = planWorkerRoute({
    queueRow: queue(910001, {
      mailbox_resource_id: 'other_box',
    }),
    settings,
  });
  assert.equal(mismatch.route, 'hold');
  assert.equal(mismatch.hold_reason, 'pointer_unresolved');
  assert.equal(mismatch.metadata_url, null);

  const blank = planWorkerRoute({
    queueRow: queue(910001, { mailbox_resource_id: '' }),
    settings,
  });
  assert.equal(blank.hold_reason, 'pointer_unresolved');
});

test('stuck non-synthetic uid 924150001 is not fetched', () => {
  const plan = planWorkerRoute({
    queueRow: queue(STUCK_REAL_UID),
    settings: {
      ...settings,
      hostinger_mail_api_base_url: `https://${HOSTINGER_LIVE_HOST}`,
      hostinger_mail_api_allowed_hosts: [HOSTINGER_LIVE_HOST],
      hostinger_live_fetch_enabled: true,
    },
  });
  assert.equal(plan.route, 'hold');
  assert.equal(plan.hold_reason, 'excluded_stuck_uid');
  assert.equal(plan.metadata_url, null);
  assert.equal(plan.text_url, null);
  assert.equal(plan.source_url, null);
});

test('synthetic path still decides happy, duplicate SQL, and hold without a fetch URL', () => {
  const synthetic = {
    from_raw: 'Customer <customer@example.com>',
    to_raw: 'info@vent-guys.com',
    subject: 'SYNTH Hello',
    date_header: 'Thu, 24 Sep 2026 12:00:00 +0000',
    bodyText: 'Hello from a synthetic fixture.\n',
    message_id: '<synth-pass1-corrective@vent-guys.test>',
    authentication_results: 'spf=pass dkim=pass dmarc=pass',
  };
  const plan = planWorkerRoute({
    queueRow: queue(42, { hostinger_pointers: { synthetic_message: synthetic } }),
    settings,
  });
  assert.equal(plan.route, 'synthetic');
  assert.equal(plan.metadata_url, null);
  const decision = evaluateIntake({
    message: { ...synthetic, mailbox: 'info@vent-guys.com' },
    settings,
  });
  assert.equal(decision.event_status, 'awaiting_pass2');
  const held = evaluateIntake({
    message: {
      ...synthetic,
      mailbox: 'info@vent-guys.com',
      reply_to_raw: 'person@other.co.uk',
    },
    settings,
  });
  assert.equal(held.event_status, 'held');
  assert.equal(held.hold_reason, 'reply_to_domain_mismatch');
  const duplicateSql = decide(910001).decided.sql;
  assert.match(duplicateSql, /ON CONFLICT \(tenant_id, mailbox, message_id\)/);
  assert.match(duplicateSql, /WHEN chosen\.was_existing THEN 'duplicate'/);
});

test('corrective SQL is staging-only, additive, and defaults fetch off', () => {
  const sql = readFileSync(join(root, 'apply/20260925_tvg_email_pass1_corrective_fetch.sql'), 'utf8');
  assert.match(sql, /glkrykpksbsqmmilmjhs/);
  assert.match(sql, /hostinger_mail_api_base_url/);
  assert.match(sql, /"disabled"/);
  assert.match(sql, /hostinger_live_fetch_enabled/);
  assert.match(sql, /924150001/);
  assert.match(sql, /ON CONFLICT \(tenant_id, key\) DO NOTHING/);
  assert.match(sql, /customer send tables must not exist/);
  assert.doesNotMatch(sql, /wwyxohjnyqnegzbxtuxs/);
  assert.doesNotMatch(sql, /INSERT INTO public/i);
  assert.doesNotMatch(sql, /CREATE TABLE[^;]*email_responses/i);
});

test('worker HTTP nodes are GET-only and the mock workflow stays inactive', () => {
  const worker = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-worker.json'), 'utf8'));
  const mock = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-hostinger-mock.json'), 'utf8'));
  assert.equal(worker.active, false);
  assert.equal(mock.active, false);
  const httpNodes = worker.nodes.filter((node) => node.type === 'n8n-nodes-base.httpRequest');
  assert.equal(httpNodes.length, 3);
  for (const node of httpNodes) {
    assert.equal(node.parameters.method, 'GET');
    assert.match(node.parameters.url, /Plan route/);
    assert.doesNotMatch(node.parameters.url, /api\.mail\.hostinger\.com/);
    assert.equal(node.credentials.httpHeaderAuth.name, 'TVG Staging Hostinger Mail API');
    assert.equal(node.credentials.httpHeaderAuth.id, 'tvg-staging-hostinger-mail-api-placeholder');
  }
  assert.equal(mock.nodes.some((node) => node.type === 'n8n-nodes-base.httpRequest'), false);
  const mockHooks = mock.nodes.filter((node) => node.type === 'n8n-nodes-base.webhook');
  assert.equal(mockHooks.length, 3);
  assert.deepEqual(
    mockHooks.map((node) => node.webhookId),
    [
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
    ],
  );
  assert.deepEqual(
    mockHooks.map((node) => node.parameters.path).sort(),
    [
      'tvg/staging-mock/mail/api/v1/mailboxes/:mailboxResourceId/folders/:folder/messages/:uid',
      'tvg/staging-mock/mail/api/v1/mailboxes/:mailboxResourceId/folders/:folder/messages/:uid/source',
      'tvg/staging-mock/mail/api/v1/mailboxes/:mailboxResourceId/folders/:folder/messages/:uid/text',
    ],
  );
  for (const name of ['Mock metadata', 'Mock text', 'Mock source']) {
    assert.equal(mock.connections[name].main[0][0].node, 'Dispatch mock');
  }
  assert.equal(mock.connections['Dispatch mock'].main[0][0].node, 'Render mock');
  assert.equal(mock.nodes.some((node) => node.name === 'Mark metadata'), false);
  assert.match(JSON.stringify(worker), /assertHostingerGetRequest/);
  assert.doesNotMatch(JSON.stringify(worker), /new URL\(|URLSearchParams/);
  for (const node of httpNodes) {
    assert.match(node.parameters.url, /\$\('Plan route'\)\.first\(\)\.json\.(metadata_url|text_url|source_url)/);
    assert.doesNotMatch(node.parameters.url, /hostinger_pointers|queue_row/);
  }
  assert.match(worker.nodes.find((node) => node.name === 'Claim pending').parameters.query, /924150001/);
  const blob = `${JSON.stringify(worker)}\n${JSON.stringify(mock)}`;
  assert.doesNotMatch(blob, /Bearer [A-Za-z0-9._\-]{20,}/);
  assert.doesNotMatch(blob, /db\.wwyxohjnyqnegzbxtuxs/);
  assert.match(blob, /productionRefForbidden/);
});

const pointer = {
  mailbox_resource_id: 'mbx_mock',
  folder: 'INBOX',
  uid: '910001',
};

function messageUrls(baseUrl) {
  return {
    metadata: buildMessageUrl(baseUrl, pointer, ''),
    text: buildMessageUrl(baseUrl, pointer, 'text'),
    source: buildMessageUrl(baseUrl, pointer, 'source'),
  };
}

function guardSample(baseUrl, urls) {
  const allowed = ['mock.staging.invalid', 'bhfos.app.n8n.cloud'];
  return {
    post: assertHostingerGetRequest({
      method: 'POST',
      url: urls.metadata,
      baseUrl,
      allowedHosts: allowed,
      liveFetchEnabled: false,
    }).reason,
    query: assertHostingerGetRequest({
      method: 'GET',
      url: `${urls.text}?injected=1`,
      baseUrl,
      allowedHosts: allowed,
      liveFetchEnabled: false,
    }).reason,
    scheme: assertHostingerGetRequest({
      method: 'GET',
      url: urls.metadata.replace('https://', 'http://'),
      baseUrl: baseUrl.replace('https://', 'http://'),
      allowedHosts: allowed,
      liveFetchEnabled: false,
    }).reason,
    traversal: assertHostingerGetRequest({
      method: 'GET',
      url: `${baseUrl}/api/v1/mailboxes/mbx_mock/folders/../messages/910001`,
      baseUrl,
      allowedHosts: allowed,
      liveFetchEnabled: false,
    }).reason,
    encodedTraversal: assertHostingerGetRequest({
      method: 'GET',
      url: `${baseUrl}/api/v1/mailboxes/mbx_mock/folders/%2e%2e/messages/910001/source`,
      baseUrl,
      allowedHosts: allowed,
      liveFetchEnabled: false,
    }).reason,
    live: assertHostingerGetRequest({
      method: 'GET',
      url: `https://${HOSTINGER_LIVE_HOST}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001/text`,
      baseUrl: `https://${HOSTINGER_LIVE_HOST}`,
      allowedHosts: [HOSTINGER_LIVE_HOST],
      liveFetchEnabled: false,
    }).reason,
    get: assertHostingerGetRequest({
      method: 'GET',
      url: urls.source,
      baseUrl,
      allowedHosts: allowed,
      liveFetchEnabled: false,
    }).ok,
  };
}

function hideSandboxGlobals() {
  const names = ['URL', 'URLSearchParams', 'Buffer', 'TextEncoder', 'TextDecoder'];
  const saved = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  for (const name of names) {
    delete globalThis[name];
    Object.defineProperty(globalThis, name, {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }
  return saved;
}

function restoreSandboxGlobals(saved) {
  for (const [name, descriptor] of saved) {
    delete globalThis[name];
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  }
}

test('path injection and queue-supplied URLs do not pass the GET guard', () => {
  const urls = messageUrls(mockBase);
  const reference = new URL(mockBase);
  reference.pathname = `${reference.pathname}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001`;
  reference.search = '';
  reference.hash = '';
  assert.equal(urls.metadata, reference.toString());
  assert.equal(urls.text, `${reference.toString()}/text`);
  assert.equal(urls.source, `${reference.toString()}/source`);

  const poisoned = planWorkerRoute({
    queueRow: queue(910001, {
      metadata_url: 'https://evil.example/steal',
      text_url: 'http://evil.example/text',
      source_url: `https://${HOSTINGER_LIVE_HOST}/api/v1/mailboxes/mbx_mock/folders/INBOX/messages/910001/source`,
      hostinger_pointers: {
        mailbox_resource_id: 'mbx_mock',
        folder: 'INBOX',
        uid: '910001',
        metadata_url: 'https://evil.example/steal',
        url: 'https://evil.example/?q=1',
      },
    }),
    settings,
  });
  assert.equal(poisoned.route, 'fetch');
  assert.equal(poisoned.metadata_url, urls.metadata);
  assert.equal(poisoned.text_url, urls.text);
  assert.equal(poisoned.source_url, urls.source);
  assert.doesNotMatch(`${poisoned.metadata_url} ${poisoned.text_url} ${poisoned.source_url}`, /evil\.example|api\.mail\.hostinger\.com/);

  const traversal = planWorkerRoute({
    queueRow: queue(910001, {
      folder: '../secret',
      hostinger_pointers: { mailbox_resource_id: 'mbx_mock', folder: '../secret', uid: '910001' },
    }),
    settings,
  });
  assert.equal(traversal.metadata_url, null);
  assert.equal(traversal.detail, 'folder_unresolved');

  const dotted = planWorkerRoute({
    queueRow: queue(910001, {
      folder: '..',
      hostinger_pointers: { mailbox_resource_id: 'mbx_mock', folder: '..', uid: '910001' },
    }),
    settings,
  });
  assert.equal(dotted.metadata_url, null);
  assert.equal(dotted.detail, 'folder_unresolved');

  const fullUrlField = planWorkerRoute({
    queueRow: queue(910001, {
      mailbox_resource_id: 'https://evil.example/api',
      hostinger_pointers: {
        mailbox_resource_id: 'https://evil.example/api',
        folder: 'INBOX',
        uid: '910001',
      },
    }),
    settings,
  });
  assert.equal(fullUrlField.metadata_url, null);
  assert.equal(fullUrlField.detail, 'mailbox_resource_id_unresolved');

  const queryUid = planWorkerRoute({
    queueRow: queue(910001, {
      uid: '910001?x=1',
      hostinger_pointers: { mailbox_resource_id: 'mbx_mock', folder: 'INBOX', uid: '910001?x=1' },
    }),
    settings,
  });
  assert.equal(queryUid.metadata_url, null);
  assert.equal(queryUid.detail, 'uid_unresolved');

  const httpPlan = planWorkerRoute({
    queueRow: queue(910001),
    settings: {
      ...settings,
      hostinger_mail_api_base_url: mockBase.replace('https://', 'http://'),
    },
  });
  assert.equal(httpPlan.route, 'hold');
  assert.equal(httpPlan.metadata_url, null);
  assert.equal(httpPlan.error_code, 'scheme_rejected');
  assert.equal(httpPlan.detail, 'metadata:scheme_rejected');

  const queriedBase = `${mockBase}?token=supersecret`;
  const stripped = planWorkerRoute({
    queueRow: queue(910001),
    settings: { ...settings, hostinger_mail_api_base_url: queriedBase },
  });
  assert.equal(stripped.metadata_url, urls.metadata);
  assert.doesNotMatch(stripped.metadata_url, /supersecret|\?/);

  const userinfo = planWorkerRoute({
    queueRow: queue(910001),
    settings: {
      ...settings,
      hostinger_mail_api_base_url: mockBase.replace('https://', 'https://user:supersecret@'),
    },
  });
  assert.equal(userinfo.metadata_url, null);
  assert.equal(userinfo.error_code, 'url_rejected');
  assert.doesNotMatch(userinfo.detail, /supersecret/);

  const broken = planWorkerRoute({
    queueRow: queue(910001),
    settings: { ...settings, hostinger_mail_api_base_url: 'not-a-url' },
  });
  assert.equal(broken.route, 'hold');
  assert.equal(broken.metadata_url, null);
  assert.match(broken.detail, /^url_build_failed:TypeError:Invalid URL$/);
  const sql = buildClosedHoldSql({
    queue_id: queue(910001).id,
    queue_status: 'held',
    hold_reason: 'pointer_unresolved',
    error_code: 'pointer_unresolved',
    detail: broken.detail,
    fetch_base_url: 'not-a-url',
  });
  assert.match(sql, /last_error = 'url_build_failed:TypeError:Invalid URL'/);
  assert.match(sql, /'url_build_failed:TypeError:Invalid URL'/);
  assert.doesNotMatch(sql, /Bearer |supersecret/);

  const guards = guardSample(mockBase, urls);
  assert.equal(guards.post, 'method_rejected');
  assert.equal(guards.query, 'query_rejected');
  assert.equal(guards.scheme, 'scheme_rejected');
  assert.equal(guards.traversal, 'path_rejected');
  assert.equal(guards.encodedTraversal, 'path_rejected');
  assert.equal(guards.live, 'live_fetch_disabled');
  assert.equal(guards.get, true);
});

test('URL building and the GET guard match when sandbox globals are removed', () => {
  const fetchSource = readFileSync(join(root, 'lib/pass1-hostinger-fetch.mjs'), 'utf8');
  assert.doesNotMatch(fetchSource, /new URL\(|URLSearchParams|TextEncoder|\bBuffer\b/);
  const withGlobals = {
    urls: messageUrls(mockBase),
    guards: null,
  };
  withGlobals.guards = guardSample(mockBase, withGlobals.urls);

  const saved = hideSandboxGlobals();
  let withoutGlobals;
  try {
    assert.equal(globalThis.URL, undefined);
    assert.equal(globalThis.URLSearchParams, undefined);
    assert.equal(globalThis.Buffer, undefined);
    assert.equal(globalThis.TextEncoder, undefined);
    withoutGlobals = {
      urls: messageUrls(mockBase),
      guards: null,
    };
    withoutGlobals.guards = guardSample(mockBase, withoutGlobals.urls);
  } finally {
    restoreSandboxGlobals(saved);
  }
  assert.equal(typeof globalThis.URL, 'function');
  assert.deepEqual(withoutGlobals.urls, withGlobals.urls);
  assert.deepEqual(withoutGlobals.guards, withGlobals.guards);

  const stripped = fetchSource
    .split('\n')
    .filter((line) => !line.startsWith('import ') && !line.startsWith('export {'))
    .map((line) => (line.startsWith('export ') ? line.slice('export '.length) : line))
    .join('\n');
  const sandbox = {
    encodeURIComponent,
    decodeURIComponent,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    JSON,
    Math,
    Error,
    TypeError,
    URIError,
    SyntaxError,
    RangeError,
    Map,
    Set,
    Date,
    parseInt,
    parseFloat,
    isFinite,
    isNaN,
  };
  assert.equal(Object.hasOwn(sandbox, 'URL'), false);
  assert.equal(Object.hasOwn(sandbox, 'URLSearchParams'), false);
  assert.equal(Object.hasOwn(sandbox, 'Buffer'), false);
  assert.equal(Object.hasOwn(sandbox, 'TextEncoder'), false);
  const script = `
    const buildOutcomeSql = () => { throw new Error('unused'); };
    const computeIdentity = () => { throw new Error('unused'); };
    const evaluateIntake = () => { throw new Error('unused'); };
    const normalizeEmail = () => '';
    const parseAuthResults = () => ({});
    const quoteLiteral = (value) => "'" + String(value) + "'";
    ${stripped}
    const pointer = { mailbox_resource_id: 'mbx_mock', folder: 'INBOX', uid: '910001' };
    const baseUrl = ${JSON.stringify(mockBase)};
    const urls = {
      metadata: buildMessageUrl(baseUrl, pointer, ''),
      text: buildMessageUrl(baseUrl, pointer, 'text'),
      source: buildMessageUrl(baseUrl, pointer, 'source'),
    };
    const allowed = ['mock.staging.invalid'];
    const guards = {
      post: assertHostingerGetRequest({ method: 'POST', url: urls.metadata, baseUrl, allowedHosts: allowed, liveFetchEnabled: false }).reason,
      query: assertHostingerGetRequest({ method: 'GET', url: urls.text + '?injected=1', baseUrl, allowedHosts: allowed, liveFetchEnabled: false }).reason,
      scheme: assertHostingerGetRequest({ method: 'GET', url: urls.metadata.replace('https://', 'http://'), baseUrl: baseUrl.replace('https://', 'http://'), allowedHosts: allowed, liveFetchEnabled: false }).reason,
      traversal: assertHostingerGetRequest({ method: 'GET', url: baseUrl + '/api/v1/mailboxes/mbx_mock/folders/../messages/910001', baseUrl, allowedHosts: allowed, liveFetchEnabled: false }).reason,
    };
    ({ urls, guards });
  `;
  const vmResult = JSON.parse(JSON.stringify(vm.runInNewContext(script, sandbox)));
  assert.deepEqual(vmResult.urls, withGlobals.urls);
  assert.equal(vmResult.guards.post, 'method_rejected');
  assert.equal(vmResult.guards.query, 'query_rejected');
  assert.equal(vmResult.guards.scheme, 'scheme_rejected');
  assert.equal(vmResult.guards.traversal, 'path_rejected');
});

const n8nFixture = JSON.parse(readFileSync(join(root, 'test/fixtures/n8n-exec-3445-full-response.json'), 'utf8'));

function assertN8nFullResponseShape(item, kind) {
  assert.deepEqual(Object.keys(item), n8nFixture.wrapper_keys);
  assert.equal(typeof item.data, 'string');
  assert.equal(item.statusCode, 200);
  assert.equal(item.statusMessage, 'OK');
  assert.equal(item.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(Object.hasOwn(item, 'body'), false);
  const envelope = JSON.parse(item.data);
  assert.equal(Object.hasOwn(envelope, 'data'), true);
  if (kind === 'source') {
    assert.equal(typeof envelope.data, 'string');
    assert.match(envelope.data, /Authentication-Results:|From: /);
  } else {
    assert.equal(typeof envelope.data, 'object');
    assert.equal(Array.isArray(envelope.data), false);
  }
}

function decideN8n(uid, items) {
  const plan = planWorkerRoute({
    queueRow: queue(uid),
    settings,
    filterRows: [],
    formSenders: [],
    contacts: [],
    leads: [],
  });
  return decideFetchedIntake({
    plan,
    metadataItem: items.metadata,
    textItem: items.text,
    sourceItem: items.source,
  });
}

function assertParseFailed(decided, endpoint) {
  assert.equal(decided.decision.queue_status, 'held');
  assert.equal(decided.decision.hold_reason, 'parse_failed');
  assert.notEqual(decided.decision.queue_status, 'done');
  assert.notEqual(decided.decision.event_status, 'awaiting_pass2');
  assert.match(decided.sql, new RegExp(`'parse_failed:${endpoint}'`));
  assert.match(decided.sql, /INSERT INTO email_automation\.automation_errors/);
  assert.match(decided.sql, /FALSE\nFROM closed/);
  assert.match(decided.sql, /NULL::uuid AS email_event_id/);
  assert.doesNotMatch(decided.sql, /INSERT INTO email_automation\.email_events/);
  assert.doesNotMatch(decided.sql, /identity_uncertain/);
  assert.doesNotMatch(decided.sql, /'done'/);
}

test('n8n full-response fixtures unwrap the double envelope and fail closed', () => {
  for (const [name, block] of [
    ['happy_910001', n8nFixture.happy_910001],
    ['missing_auth_910601', n8nFixture.missing_auth_910601],
    ['missing_message_id_and_date_910602', n8nFixture.missing_message_id_and_date_910602],
  ]) {
    assertN8nFullResponseShape(block.metadata, 'metadata');
    assertN8nFullResponseShape(block.text, 'text');
    assertN8nFullResponseShape(block.source, 'source');
    const renderedMeta = JSON.stringify(renderMockHostingerResponse({
      uid: name.endsWith('910001') ? 910001 : name.endsWith('910601') ? 910601 : 910602,
      kind: 'metadata',
    }).response_body);
    assert.equal(block.metadata.data, renderedMeta);
  }

  const happy = decideN8n(910001, n8nFixture.happy_910001);
  assert.equal(happy.decision.event_status, 'awaiting_pass2');
  assert.equal(happy.decision.queue_status, 'done');
  assert.match(happy.sql, /INSERT INTO email_automation\.email_events/);
  assert.match(happy.sql, /'awaiting_pass2'/);
  assert.match(happy.sql, /pat@example.com/);
  assert.match(happy.sql, /Synthetic mock inquiry/);
  assert.doesNotMatch(happy.sql, /identity_uncertain_no_event|parse_failed/);

  const rawRfc822Item = n8nFixture.happy_910001.source_raw_rfc822_application_json;
  assert.equal(rawRfc822Item.headers['content-type'], 'application/json; charset=utf-8');
  assert.match(rawRfc822Item.data, /^Message-ID:/);
  const rawSource = decideN8n(910001, {
    metadata: n8nFixture.happy_910001.metadata,
    text: n8nFixture.happy_910001.text,
    source: rawRfc822Item,
  });
  assert.equal(rawSource.decision.event_status, 'awaiting_pass2');
  assert.equal(rawSource.decision.queue_status, 'done');

  const jsonObjectSource = decideN8n(910001, {
    metadata: n8nFixture.happy_910001.metadata,
    text: n8nFixture.happy_910001.text,
    source: {
      data: '{"from":"spoofed@evil.example"}',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      statusCode: 200,
      statusMessage: 'OK',
    },
  });
  assert.equal(jsonObjectSource.decision.hold_reason, 'identity_uncertain');
  assert.equal(jsonObjectSource.decision.event_status, 'held');
  assert.match(jsonObjectSource.sql, /INSERT INTO email_automation\.email_events/);
  assert.match(jsonObjectSource.sql, /pat@example.com/);
  assert.doesNotMatch(jsonObjectSource.sql, /spoofed@evil\.example|parse_failed/);

  const noAuth = decideN8n(910601, n8nFixture.missing_auth_910601);
  assert.equal(noAuth.decision.hold_reason, 'identity_uncertain');
  assert.equal(noAuth.decision.event_status, 'held');
  assert.equal(noAuth.decision.queue_status, 'held');
  assert.match(noAuth.sql, /INSERT INTO email_automation\.email_events/);
  assert.doesNotMatch(noAuth.sql, /parse_failed|identity_uncertain_no_event/);

  const noId = decideN8n(910602, n8nFixture.missing_message_id_and_date_910602);
  assert.equal(noId.decision.event_status, 'awaiting_pass2');
  assert.equal(noId.decision.queue_status, 'done');
  assert.match(noId.sql, /message_id = NULL/);
  assert.match(noId.sql, /fallback_hash = 'v2:[0-9a-f]{64}'/);

  const again = decideN8n(910602, n8nFixture.missing_message_id_and_date_910602);
  const hashOf = (sql) => sql.match(/fallback_hash = '(v2:[0-9a-f]{64})'/)[1];
  assert.equal(hashOf(noId.sql), hashOf(again.sql));
  const expected = computeIdentity({
    mailbox_email: 'info@vent-guys.com',
    from_email: 'pat@example.com',
    to_email: 'info@vent-guys.com',
    subject: 'Synthetic mock inquiry',
    date_header: '',
    bodyText: 'Hello from mock uid 910602.',
    bodyHtml: '',
    message_id: '',
  });
  assert.equal(hashOf(noId.sql), expected.fallback_hash);
  assert.equal(expected.message_id, null);
  assert.match(noId.sql, /ON CONFLICT \(tenant_id, mailbox, fallback_hash\) WHERE fallback_hash IS NOT NULL DO NOTHING/);
  assert.match(again.sql, /ON CONFLICT \(tenant_id, mailbox, fallback_hash\) WHERE fallback_hash IS NOT NULL DO NOTHING/);
  assert.equal((noId.sql.match(/INSERT INTO email_automation\.email_events/g) || []).length, 1);
  assert.equal((again.sql.match(/INSERT INTO email_automation\.email_events/g) || []).length, 1);

  const replacements = {
    empty: '',
    null: 'null',
    invalid_json: '{',
    number: '1',
    array: '[1]',
    string: '"hello"',
    missing_envelope: '{}',
    data_not_object: '{"data":"text"}',
  };
  for (const endpoint of ['metadata', 'text']) {
    for (const [label, data] of Object.entries(replacements)) {
      const items = {
        metadata: n8nFixture.happy_910001.metadata,
        text: n8nFixture.happy_910001.text,
        source: n8nFixture.happy_910001.source,
      };
      items[endpoint] = {
        data,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        statusCode: 200,
        statusMessage: 'OK',
      };
      const decided = decideN8n(910001, items);
      assertParseFailed(decided, endpoint);
      const reason = label === 'data_not_object'
        ? 'missing_envelope'
        : (label === 'number' || label === 'array' || label === 'string' ? 'non_object' : label);
      assert.match(decided.sql, new RegExp(`'${reason}'`));
    }
  }
});

test('exec 3445 fixtures fail on df42e8ff Normalize and pass on the fix', async () => {
  const repo = join(root, '../..');
  const oldSource = execFileSync(
    'git',
    ['show', 'df42e8ff:tvg-email-automation/pass1/lib/pass1-hostinger-fetch.mjs'],
    { cwd: repo, encoding: 'utf8' },
  );
  assert.match(oldSource, /function unwrapHttp\(item\)/);
  assert.doesNotMatch(oldSource, /parseJsonEnvelope/);
  const intakeUrl = pathToFileURL(join(root, 'lib/pass1-intake-logic.mjs')).href;
  const rewritten = oldSource.replace("from './pass1-intake-logic.mjs'", `from '${intakeUrl}'`);
  const dir = mkdtempSync(join(tmpdir(), 'df42e8ff-fetch-'));
  const file = join(dir, 'pass1-hostinger-fetch.mjs');
  writeFileSync(file, rewritten);
  const oldMod = await import(pathToFileURL(file).href);
  const plan = planWorkerRoute({
    queueRow: queue(910001),
    settings,
    filterRows: [],
    formSenders: [],
    contacts: [],
    leads: [],
  });
  const items = {
    plan,
    metadataItem: n8nFixture.happy_910001.metadata,
    textItem: n8nFixture.happy_910001.text,
    sourceItem: n8nFixture.happy_910001.source,
  };
  const before = oldMod.decideFetchedIntake(items);
  const after = decideFetchedIntake(items);
  console.log(`REGRESSION df42e8ff: queue=${before.decision.queue_status} hold=${before.decision.hold_reason} event=${before.decision.event_status} identity_uncertain_no_event=${/identity_uncertain_no_event/.test(before.sql)} email_events=${/INSERT INTO email_automation\.email_events/.test(before.sql)}`);
  console.log(`REGRESSION fix: queue=${after.decision.queue_status} event=${after.decision.event_status} awaiting_pass2=${/awaiting_pass2/.test(after.sql)} email_events=${/INSERT INTO email_automation\.email_events/.test(after.sql)}`);
  assert.match(before.sql, /identity_uncertain_no_event/);
  assert.equal(before.decision.queue_status, 'held');
  assert.equal(before.decision.hold_reason, 'identity_uncertain');
  assert.doesNotMatch(before.sql, /INSERT INTO email_automation\.email_events/);
  assert.notEqual(before.decision.queue_status, 'done');
  assert.equal(after.decision.event_status, 'awaiting_pass2');
  assert.equal(after.decision.queue_status, 'done');
  assert.match(after.sql, /INSERT INTO email_automation\.email_events/);
  assert.doesNotMatch(after.sql, /identity_uncertain_no_event|parse_failed/);
});
