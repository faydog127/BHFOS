import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { planFastAck } from '../lib/pass1-intake-logic.mjs';
import {
  assertHostingerGetRequest,
  assertHostingerListRequest,
  buildListMessagesUrl,
  buildManualReresolveSql,
  buildResolveWriteSql,
  buildWorkerPointerHoldSql,
  decideFetchedIntake,
  evaluateResolvePages,
  manualReresolveAllowed,
  midKey,
  parseListEnvelope,
  pendingSlaExempt,
  planWorkerRoute,
  renderMockHostingerResponse,
  renderMockListMessages,
  zeroMatchAction,
} from '../lib/pass1-hostinger-fetch.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://api.mail.hostinger.com';
const allowed = ['api.mail.hostinger.com'];
const mockBase = 'https://mock.staging.invalid/webhook-test/tvg/staging-mock/mail';
const QUEUE_ID = '30000000-0000-4000-8000-0000000000aa';

function envelope(overrides = {}, dataOverrides = {}) {
  return {
    id: '245ea272-c21e-548a-b9dd-fea1ee0230fd',
    event: 'message.received',
    timestamp: '2026-09-26T04:20:52.000Z',
    subject: 'SENTINEL_SUBJECT',
    from: 'SENTINEL_FROM',
    to: 'SENTINEL_TO',
    bodyUrl: 'https://signed.example/SENTINEL_URL',
    text: 'SENTINEL_BODY',
    html: 'SENTINEL_HTML',
    ...overrides,
    data: {
      eventId: '245ea272-c21e-548a-b9dd-fea1ee0230fd',
      mailboxAddress: 'info@vent-guys.com',
      messageId: '<real-id@example.com>',
      ...dataOverrides,
    },
  };
}

function queue(extra = {}) {
  return {
    id: QUEUE_ID,
    tenant_id: 'tvg',
    mailbox: 'info@vent-guys.com',
    mailbox_resource_id: 'mbx_mock',
    folder: 'INBOX',
    uid: null,
    resolution_status: 'unresolved',
    webhook_message_id: '<mock-list@example.com>',
    webhook_event_at: '2026-09-29T05:00:00.000Z',
    resolve_attempts: 0,
    attempt_count: 40,
    status: 'processing',
    hostinger_pointers: {},
    ...extra,
  };
}

const resolveSettings = {
  hostinger_mail_api_base_url: mockBase,
  hostinger_mail_api_allowed_hosts: ['mock.staging.invalid'],
  hostinger_live_fetch_enabled: false,
  hostinger_mailbox_map: { 'info@vent-guys.com': 'mbx_mock' },
  resolve_max_pages: 3,
  resolve_lookback_hours: 48,
  resolve_max_attempts: 5,
  resolve_backoff_minutes: [1, 2, 5, 10, 20],
  resolve_429_max_consumed: 2,
};

function asTextEnvelope(rendered) {
  return {
    statusCode: rendered.http_status,
    timeout: rendered.timeout,
    data: JSON.stringify(rendered.response_body),
    headers: {},
    statusMessage: 'OK',
  };
}

function asBodyEnvelope(rendered) {
  return { statusCode: rendered.http_status, timeout: rendered.timeout, body: rendered.response_body };
}

test('T5 mixed-case and whitespace mailbox normalizes', () => {
  const planned = planFastAck(envelope({}, { mailboxAddress: '  INFO@Vent-Guys.com ' }));
  assert.equal(planned.http_status, 200);
  assert.match(planned.sql, /'info@vent-guys.com'/);
  assert.equal(planned.sql.includes('INFO@Vent-Guys.com'), false);
});

test('T7 midKey equivalence table', () => {
  assert.equal(midKey('<A@B>'), 'a@b');
  assert.equal(midKey('a@b'), 'a@b');
  assert.equal(midKey(' <a@B> '), 'a@b');
  assert.equal(midKey('<<a@b>>'), null);
  assert.equal(midKey('a b@c'), null);
  assert.equal(midKey(''), null);
});

test('T10 a resolved excluded uid holds pointer_excluded_uid', () => {
  const page = asTextEnvelope({
    http_status: 200,
    timeout: false,
    response_body: {
      data: [{
        uid: 3101,
        path: 'INBOX',
        messageId: '<mock-list@example.com>',
        date: '2026-09-29T05:00:00.000Z',
      }],
      pagination: { page: 1, perPage: 100, total: 1, totalPages: 1 },
    },
  });
  const evaluation = evaluateResolvePages({
    pages: [page],
    queueRow: queue({ webhook_message_id: '<mock-list@example.com>' }),
    settings: { ...resolveSettings, hostinger_fetch_excluded_uids: [3101], resolve_max_pages: 1 },
  });
  assert.equal(evaluation.hold, true);
  assert.equal(evaluation.excluded, true);
  assert.equal(evaluation.resolved, false);
  assert.equal(evaluation.error_code, 'pointer_excluded_uid');
});

test('T13 a mailbox-map change holds mailbox_map_changed before any URL', () => {
  const routed = planWorkerRoute({
    queueRow: queue({ mailbox_resource_id: 'mbx_old' }),
    settings: {
      ...resolveSettings,
      hostinger_mailbox_map: { 'info@vent-guys.com': 'mbx_new' },
    },
  });
  assert.equal(routed.route, 'hold');
  assert.equal(routed.hold_reason, 'mailbox_map_changed');
  assert.equal(routed.error_code, 'mailbox_map_changed');
  assert.equal(routed.metadata_url, null);
  assert.equal(routed.text_url, null);
  assert.equal(routed.source_url, null);
});

function executePrepareIntake(messageId) {
  const workflow = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-fast-ack.json'), 'utf8'));
  const node = workflow.nodes.find((item) => item.name === 'Prepare intake');
  assert.ok(node, 'Prepare intake node is present in the committed Fast ACK JSON');
  const body = envelope({}, { messageId });
  const planned = vm.runInNewContext(
    `(function () {\n${node.parameters.jsCode}\n})()`,
    { $input: { first() { return { json: body }; } } },
    { timeout: 2000 },
  );
  assert.equal(Array.isArray(planned), true);
  return planned[0].json;
}

test('committed Fast ACK Prepare intake stores NULL for whitespace-only Message-ID', () => {
  for (const messageId of ['\r\n', '\t', ' \r\n\t ']) {
    const fromNode = executePrepareIntake(messageId);
    const fromLib = planFastAck(envelope({}, { messageId }));
    assert.equal(fromNode.http_status, 200);
    assert.equal(fromNode.http_status, fromLib.http_status);
    assert.equal(fromNode.sql, fromLib.sql);
    assert.match(fromNode.sql, /\n {4}NULL,\n {4}'unresolved',/);
    assert.equal(fromNode.response_body.error, undefined);
  }
});

test('committed workflow JSON matches a temp rebuild of build-workflows.mjs', () => {
  const temp = mkdtempSync(join(tmpdir(), 'tvg-n8n-parity-'));
  try {
    const result = spawnSync(process.execPath, [join(root, 'n8n/build-workflows.mjs')], {
      env: { ...process.env, TVG_N8N_OUT_DIR: temp },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const names = [
      'tvg-email-intake-fast-ack.json',
      'tvg-email-intake-worker.json',
      'tvg-email-hostinger-mock.json',
      'tvg-email-intake-reconcile.json',
      'tvg-email-daily-filtered-digest.json',
      'tvg-email-notification-dispatcher.json',
      'tvg-email-health-heartbeat.json',
    ];
    assert.deepEqual(readdirSync(temp).sort(), [...names].sort());
    for (const name of names) {
      assert.equal(
        readFileSync(join(temp, name), 'utf8'),
        readFileSync(join(root, 'n8n', name), 'utf8'),
        name,
      );
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('operator templates stay unapplied and keep the one-row safeguards', () => {
  const strip = (sql) => sql.replace(/--[^\n]*/g, '');
  const stranded = readFileSync(join(root, 'apply/20260929_tvg_email_pass1_stranded_rows.sql'), 'utf8');
  const recovery = readFileSync(join(root, 'apply/20260929_tvg_email_pass1_stale_processing_recovery.sql'), 'utf8');
  const preflight = readFileSync(join(root, 'apply/20260929_tvg_email_pass1_resolve_max_attempts_preflight.sql'), 'utf8');
  const migration = readFileSync(join(root, 'apply/20260929_tvg_email_pass1_pointer_contract.sql'), 'utf8');
  const rollback = readFileSync(join(root, 'apply/20260929_tvg_email_pass1_pointer_contract_ROLLBACK.sql'), 'utf8');
  const strandedExec = strip(stranded);
  assert.match(strandedExec, /status IN \('held', 'error'\)/);
  assert.match(strandedExec, /email_event_id/);
  assert.equal(/\b(UPDATE|INSERT|DELETE|ALTER)\b/i.test(strandedExec), false);
  assert.match(recovery, /q\.status = 'held'/);
  assert.match(recovery, /q\.hold_reason = 'stale_processing'/);
  assert.match(recovery, /q\.resolution_status = 'unresolved'/);
  assert.match(recovery, /q\.uid IS NULL/);
  assert.match(recovery, /locked_at = NULL/);
  assert.match(recovery, /locked_by = NULL/);
  assert.match(recovery, /placeholder refused/);
  assert.match(recovery, /00000000-0000-4000-8000-000000000000/);
  assert.match(preflight, /resolve_max_attempts must be exactly 5/);
  assert.match(migration, /'resolve_max_attempts', '5'::jsonb/);
  for (const sql of [migration, rollback]) {
    const executable = strip(sql);
    const beginAt = executable.indexOf('BEGIN;');
    const timeoutAt = executable.indexOf("SET LOCAL lock_timeout = '5s';");
    assert.ok(beginAt >= 0 && timeoutAt > beginAt && timeoutAt < executable.indexOf('LOCK TABLE'));
  }
  const workflows = readFileSync(join(root, 'n8n/build-workflows.mjs'), 'utf8');
  assert.equal(workflows.includes('stale_processing_recovery'), false);
  assert.equal(workflows.includes('stranded_rows'), false);
  assert.equal(workflows.includes('resolve_max_attempts_preflight'), false);
});

test('T1 real-shape fixture keeps sentinels out of the planned SQL', () => {
  const planned = planFastAck(envelope());
  assert.equal(planned.http_status, 200);
  assert.equal(planned.sql.includes('SENTINEL_'), false);
  assert.doesNotMatch(planned.sql, /bodyUrl|signed\.example/);
  assert.match(planned.sql, /webhook_event_id/);
  assert.match(planned.sql, /<real-id@example.com>/);
});

test('T2 missing or non-string event is envelope_malformed', () => {
  for (const body of [{}, { event: 1 }, { event: null }, { timestamp: '2026-09-26T04:20:52.000Z' }]) {
    const planned = planFastAck(body);
    assert.equal(planned.http_status, 400);
    assert.equal(planned.response_body.error, 'envelope_malformed');
    assert.equal(planned.sql, null);
  }
});

test('T3 unsupported events are ignored before shape checks', () => {
  for (const event of ['message.deleted', 'Message.Received', '', 'other']) {
    const planned = planFastAck({ event, data: 'not-an-object' });
    assert.equal(planned.http_status, 200);
    assert.deepEqual(planned.response_body, { ok: true, ignored: 'unsupported_event' });
    assert.equal(planned.sql, null);
  }
});

test('T4 missing Message-ID is a pending insert and the Fast ACK SQL has no hold', () => {
  for (const messageId of [undefined, null, '', '   ', '\n\t']) {
    const body = envelope({}, { messageId });
    if (messageId === undefined) delete body.data.messageId;
    const planned = planFastAck(body);
    if (typeof messageId === 'string' && /[\u0000-\u001F]/.test(messageId) && messageId.trim() !== '') {
      assert.equal(planned.http_status, 400);
      continue;
    }
    assert.equal(planned.http_status, 200);
    assert.equal(planned.response_body.held, undefined);
    assert.match(planned.sql, /webhook_message_id/);
    assert.match(planned.sql, /NULL/);
    assert.match(planned.sql, /'unresolved'/);
    assert.match(planned.sql, /'pending'::email_automation\.intake_queue_status/);
    assert.match(planned.sql, /'deferred_kill_switch'::email_automation\.intake_queue_status/);
    assert.equal(planned.sql.includes("'held'"), false);
    assert.equal(planned.sql.includes('hold_reason'), false);
    assert.equal(planned.sql.includes('message_id_missing'), false);
    assert.equal(planned.sql.includes('automation_errors'), false);
  }
  const dirty = planFastAck(envelope({}, { messageId: 'bad\r\nid@example.com' }));
  assert.equal(dirty.http_status, 400);
  const huge = planFastAck(envelope({}, { messageId: `${'a'.repeat(990)}@example.com` }));
  assert.equal(huge.http_status, 400);
});

test('T8 time-window stop and an unparsable date', () => {
  const oldPage = asBodyEnvelope({
    http_status: 200,
    timeout: false,
    response_body: {
      data: [
        { uid: 11, path: 'INBOX', messageId: '<other@example.com>', date: '2026-09-01T00:00:00.000Z' },
        { uid: 12, path: 'INBOX', messageId: '<other2@example.com>', date: '2026-09-01T00:00:00.000Z' },
      ],
      pagination: { page: 1, perPage: 100, total: 2, totalPages: 3 },
    },
  });
  const stopped = evaluateResolvePages({ pages: [oldPage, oldPage, oldPage], queueRow: queue(), settings: resolveSettings });
  assert.equal(stopped.stop_reason, 'time_window');
  assert.equal(stopped.pages_scanned, 1);
  assert.equal(stopped.zero_match, true);
  const mixed = asBodyEnvelope({
    http_status: 200,
    timeout: false,
    response_body: {
      data: [
        { uid: 11, path: 'INBOX', messageId: '<other@example.com>', date: '2026-09-01T00:00:00.000Z' },
        { uid: 12, path: 'INBOX', messageId: '<other2@example.com>', date: 'not-a-date' },
      ],
      pagination: { page: 1, perPage: 100, total: 2, totalPages: 1 },
    },
  });
  const continued = evaluateResolvePages({ pages: [mixed], queueRow: queue(), settings: resolveSettings });
  assert.equal(continued.stop_reason, 'max_pages');
  assert.equal(continued.pages_scanned, 1);
});

test('T9 schedule and the third 429', () => {
  const miss = renderMockListMessages({ scenario: 'mbx_list_miss', page: 1 });
  const pages = [1, 2, 3].map((page) => renderMockListMessages({ scenario: 'mbx_list_miss', page }));
  const minutes = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = queue({ resolve_attempts: attempt, attempt_count: 40 + attempt });
    const evaluation = evaluateResolvePages({ pages, queueRow: row, settings: resolveSettings });
    assert.equal(evaluation.retry, true, `attempt ${attempt + 1}`);
    const written = buildResolveWriteSql({ queueRow: row, settings: resolveSettings, evaluation });
    assert.equal(written.outcome, 'rescheduled');
    assert.match(written.sql, /resolve_attempts = q\.resolve_attempts \+ 1/);
    assert.doesNotMatch(written.sql, /attempt_count\s*=/);
    const action = zeroMatchAction(row, resolveSettings);
    minutes.push(action.minutes);
  }
  assert.deepEqual(minutes, [1, 2, 5, 10, 20]);
  const sixth = evaluateResolvePages({
    pages,
    queueRow: queue({ resolve_attempts: 5, attempt_count: 99 }),
    settings: resolveSettings,
  });
  assert.equal(sixth.hold, true);
  assert.equal(sixth.error_code, 'pointer_not_found');
  const limited = evaluateResolvePages({
    pages: [{ statusCode: 429, timeout: false }],
    queueRow: queue({
      resolve_attempts: 0,
      hostinger_pointers: { resolution: { rate_limit_consumed: 2 } },
    }),
    settings: resolveSettings,
  });
  assert.equal(limited.hold, true);
  assert.equal(limited.error_code, 'hostinger_rate_limited');
  assert.equal(miss.http_status, 200);
});

test('T14 message_id_missing makes no HTTP call and the hold branch has no fetch edge', () => {
  const plan = planWorkerRoute({
    queueRow: queue({ webhook_message_id: null }),
    settings: resolveSettings,
  });
  assert.equal(plan.route, 'hold');
  assert.equal(plan.hold_reason, 'message_id_missing');
  assert.equal(plan.metadata_url, null);
  assert.equal(plan.text_url, null);
  assert.equal(plan.source_url, null);
  const worker = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-worker.json'), 'utf8'));
  const closed = worker.connections['Closed hold'].main.flat().map((edge) => edge.node);
  assert.deepEqual(closed, ['Write outcome']);
  for (const name of ['Plan resolve', 'Re-guard list', 'List page', 'Fetch metadata', 'Fetch text', 'Fetch source']) {
    assert.equal(closed.includes(name), false, name);
  }
  assert.equal(worker.connections['Needs resolve'].main[0][0].node, 'Plan resolve');
  assert.equal(worker.connections['Needs resolve'].main[1][0].node, 'Is fetch');
});

test('T17 literal GET on httpRequest nodes and no outbound mutation verbs', () => {
  const files = [
    'n8n/tvg-email-intake-fast-ack.json',
    'n8n/tvg-email-intake-worker.json',
    'n8n/tvg-email-hostinger-mock.json',
  ];
  const forbidden = ['DELETE', 'PATCH', 'PUT', 'sendBody', '/flags', '/move', '/search'];
  for (const relative of files) {
    const workflow = JSON.parse(readFileSync(join(root, relative), 'utf8'));
    const httpNodes = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.httpRequest');
    if (relative.endsWith('fast-ack.json') || relative.endsWith('mock.json')) assert.equal(httpNodes.length, 0);
    for (const node of httpNodes) {
      assert.equal(node.parameters.method, 'GET');
      assert.equal(typeof node.parameters.method, 'string');
    }
    for (const node of workflow.nodes) {
      if (node.type === 'n8n-nodes-base.webhook') continue;
      const blob = JSON.stringify(node);
      for (const word of forbidden) assert.equal(blob.includes(word), false, `${relative}:${node.name}:${word}`);
      if (node.type !== 'n8n-nodes-base.httpRequest') {
        assert.equal(blob.includes('POST'), false, `${relative}:${node.name}:POST`);
      }
    }
  }
});

test('T17b list guard rejects mutations, bad queries, and a disabled live host', () => {
  const good = buildListMessagesUrl(base, 'mbx_live', 1);
  assert.equal(assertHostingerListRequest({
    method: 'GET', url: good, baseUrl: base, allowedHosts: allowed, liveFetchEnabled: true,
  }).ok, true);
  const cases = [
    ['DELETE', good, base, allowed, true],
    ['POST', good, base, allowed, true],
    ['PATCH', good, base, allowed, true],
  ];
  for (const [method, url, baseUrl, hosts, live] of cases) {
    assert.equal(assertHostingerListRequest({
      method, url, baseUrl, allowedHosts: hosts, liveFetchEnabled: live,
    }).ok, false);
  }
  const reject = (url) => assertHostingerListRequest({
    method: 'GET', url, baseUrl: base, allowedHosts: allowed, liveFetchEnabled: true,
  });
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx_live/folders/INBOX/messages/15?page=1&perPage=100`).ok, false);
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx_live/folders/Sent/messages?page=1&perPage=100`).ok, false);
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx_live/folders/INBOX/messages?page=0&perPage=100`).ok, false);
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx_live/folders/INBOX/messages?page=6&perPage=100`).ok, false);
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx_live/folders/INBOX/messages?page=1&perPage=50`).ok, false);
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx_live/folders/INBOX/messages?page=1&perPage=100&extra=1`).ok, false);
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx_live/folders/INBOX/%2e%2e/messages?page=1&perPage=100`).ok, false);
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx1%2Ffolders/INBOX/messages?page=1&perPage=100`).reason, 'path_rejected');
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx_live/folders/%49NBOX/messages?page=1&perPage=100`).reason, 'path_rejected');
  assert.equal(reject(` ${good}`).reason, 'url_rejected');
  assert.equal(reject(`${good} `).reason, 'url_rejected');
  assert.equal(reject(`${base}/api/v1/mailboxes/mbx live/folders/INBOX/messages?page=1&perPage=100`).reason, 'path_rejected');
  assert.equal(assertHostingerListRequest({
    method: 'get', url: good, baseUrl: base, allowedHosts: allowed, liveFetchEnabled: true,
  }).reason, 'method_rejected');
  const goodGet = `${base}/api/v1/mailboxes/mbx_live/folders/INBOX/messages/123`;
  const rejectGet = (url, method = 'GET') => assertHostingerGetRequest({
    method, url, baseUrl: base, allowedHosts: allowed, liveFetchEnabled: true,
  });
  assert.equal(rejectGet(goodGet).ok, true);
  assert.equal(rejectGet(goodGet, 'get').ok, true);
  assert.equal(rejectGet(`${base}/api/v1/mailboxes/mbx1%2Ffolders/INBOX/messages/123`).reason, 'path_rejected');
  assert.equal(rejectGet(`${base}/api/v1/mailboxes/mbx_live/folders/%49NBOX/messages/123`).reason, 'path_rejected');
  assert.equal(rejectGet(` ${goodGet}`).reason, 'url_rejected');
  assert.equal(rejectGet(`${goodGet} `).reason, 'url_rejected');
  assert.equal(reject(`https://user:secret@api.mail.hostinger.com/api/v1/mailboxes/mbx_live/folders/INBOX/messages?page=1&perPage=100`).ok, false);
  assert.equal(assertHostingerListRequest({
    method: 'GET', url: good, baseUrl: base, allowedHosts: ['example.test'], liveFetchEnabled: true,
  }).ok, false);
  assert.equal(assertHostingerListRequest({
    method: 'GET', url: good, baseUrl: base, allowedHosts: allowed, liveFetchEnabled: false,
  }).reason, 'live_fetch_disabled');
});

test('T18 evaluate output is uids, counts, and flags only', () => {
  const page = asTextEnvelope({
    http_status: 200,
    timeout: false,
    response_body: {
      data: [{
        uid: 4101,
        path: 'INBOX',
        messageId: '<mock-list@example.com>',
        date: '2026-09-29T05:00:00.000Z',
        subject: 'SENTINEL_SUBJECT',
        from: 'SENTINEL_FROM',
        to: 'SENTINEL_TO',
        extra: 'SENTINEL_MID_OTHER',
      }],
      pagination: { page: 1, perPage: 100, total: 1, totalPages: 1 },
    },
  });
  const evaluation = evaluateResolvePages({
    pages: [page],
    queueRow: queue({ webhook_message_id: '<mock-list@example.com>' }),
    settings: { ...resolveSettings, resolve_max_pages: 1 },
  });
  const serialized = JSON.stringify(evaluation);
  assert.equal(serialized.includes('SENTINEL_'), false);
  assert.equal(serialized.includes('mock-list@example.com'), false);
  const allowed = new Set([
    'matches', 'pages_scanned', 'total', 'items_seen', 'invalid_items', 'stop_reason',
    'zero_match', 'ambiguous', 'excluded', 'resolved', 'retry', 'hold', 'error', 'error_code',
  ]);
  const enums = new Set(['time_window', 'max_pages', 'rate_limited', 'timeout', 'upstream', 'auth', 'malformed', null]);
  for (const [key, value] of Object.entries(evaluation)) {
    assert.equal(allowed.has(key), true, key);
    if (key === 'matches') {
      assert.equal(Array.isArray(value), true);
      assert.equal(value.every((uid) => Number.isInteger(uid)), true);
    } else if (key === 'stop_reason') {
      assert.equal(enums.has(value) || typeof value === 'string', true);
    } else if (key === 'error_code') {
      assert.equal(value == null || typeof value === 'string', true);
    } else if (['pages_scanned', 'total', 'items_seen', 'invalid_items'].includes(key)) {
      assert.equal(typeof value, 'number');
    } else {
      assert.equal(typeof value, 'boolean');
    }
  }
  const written = buildResolveWriteSql({
    queueRow: queue(),
    settings: resolveSettings,
    evaluation,
  });
  assert.equal(JSON.stringify(written).includes('SENTINEL_'), false);
  assert.equal(written.sql.includes('mock-list@example.com'), false);
  assert.equal(evaluation.resolved, true);
  assert.deepEqual(evaluation.matches, [4101]);
});

test('T19 retention settings', () => {
  const fast = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-fast-ack.json'), 'utf8'));
  const worker = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-worker.json'), 'utf8'));
  assert.equal(fast.settings.saveDataSuccessExecution, 'none');
  assert.equal(fast.settings.saveDataErrorExecution, 'none');
  assert.equal(fast.settings.saveManualExecutions, false);
  assert.equal(worker.settings.saveDataSuccessExecution, 'none');
  assert.equal(worker.settings.saveDataErrorExecution, 'none');
  assert.equal(worker.settings.saveManualExecutions, false);
  assert.equal(worker.meta.retention, 'success-none-error-none-manual-false');
  const note = worker.nodes.find((node) => node.name === 'STAGING ONLY / HOSTINGER OFF').parameters.content;
  assert.match(note, /Manual execution saving is off/);
  assert.equal(note.includes('must be turned off'), false);
});

test('Worker artifact does not emit saveManualExecutions true', () => {
  const worker = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-worker.json'), 'utf8'));
  assert.equal(worker.settings.saveManualExecutions, false);
  assert.equal(JSON.stringify(worker.settings).includes('"saveManualExecutions":true'), false);
});

test('T21 schedule is not preempted by attempt_count and future retries are skipped', () => {
  const migration = readFileSync(join(root, 'apply/20260929_tvg_email_pass1_pointer_contract.sql'), 'utf8');
  const claim = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-worker.json'), 'utf8'))
    .nodes.find((node) => node.name === 'Claim pending').parameters.query;
  const stale = readFileSync(join(root, 'apply/reconcile_stale_to_hold.sql'), 'utf8');
  const executable = migration.replace(/--[^\n]*/g, '');
  assert.equal(/attempt_count\s*<=/.test(executable), false);
  assert.equal(/attempt_count\s*</.test(executable), false);
  assert.equal(/CHECK\s*\([^;]*attempt_count/i.test(executable), false);
  assert.match(claim, /next_attempt_at IS NULL OR q\.next_attempt_at <= now\(\)/);
  assert.match(stale, /q\.status = 'processing'/);
  assert.equal(stale.includes("status = 'pending'"), false);
  const row = queue({
    status: 'pending',
    resolve_attempts: 0,
    attempt_count: 50,
    next_attempt_at: '2099-01-01T00:00:00.000Z',
    webhook_message_id: '<real-id@example.com>',
    created_at: '2026-09-29T05:00:00.000Z',
  });
  assert.equal(pendingSlaExempt(row, new Date('2026-09-29T05:10:00.000Z')), true);
  const highCount = zeroMatchAction(queue({ resolve_attempts: 0, attempt_count: 50 }), resolveSettings);
  assert.equal(highCount.action, 'reschedule');
  assert.equal(highCount.minutes, 1);
  const missing = queue({
    status: 'pending',
    webhook_message_id: null,
    next_attempt_at: null,
    created_at: '2026-09-29T05:00:00.000Z',
  });
  assert.equal(pendingSlaExempt(missing, new Date('2026-09-29T05:10:00.000Z')), false);
});

test('T22 reschedule clears the lock and increments resolve_attempts by one', () => {
  const written = buildResolveWriteSql({
    queueRow: queue({ resolve_attempts: 2, attempt_count: 11 }),
    settings: resolveSettings,
    evaluation: evaluateResolvePages({
      pages: [1, 2, 3].map((page) => renderMockListMessages({ scenario: 'mbx_list_miss', page })),
      queueRow: queue({ resolve_attempts: 2, attempt_count: 11 }),
      settings: resolveSettings,
    }),
  });
  assert.equal(written.outcome, 'rescheduled');
  assert.match(written.sql, /locked_at = NULL/);
  assert.match(written.sql, /locked_by = NULL/);
  assert.match(written.sql, /status = 'pending'/);
  assert.match(written.sql, /resolve_attempts = q\.resolve_attempts \+ 1/);
  assert.doesNotMatch(written.sql, /attempt_count\s*=/);
  assert.match(written.sql, /make_interval\(mins => 5\)/);
});

test('T23 date is never a match criterion', () => {
  const page = asBodyEnvelope({
    http_status: 200,
    timeout: false,
    response_body: {
      data: [
        {
          uid: 501,
          path: 'INBOX',
          messageId: '<other@example.com>',
          date: '2026-09-29T05:00:00.000Z',
        },
        {
          uid: 502,
          path: 'INBOX',
          messageId: '<Mock-List@Example.com>',
          date: '2026-09-20T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, perPage: 100, total: 2, totalPages: 1 },
    },
  });
  const evaluation = evaluateResolvePages({
    pages: [page],
    queueRow: queue({ webhook_message_id: '<mock-list@example.com>' }),
    settings: { ...resolveSettings, resolve_max_pages: 1 },
  });
  assert.deepEqual(evaluation.matches, [502]);
  assert.equal(evaluation.resolved, true);
});

test('T24 a null listed Message-ID does not match', () => {
  const evaluation = evaluateResolvePages({
    pages: [renderMockListMessages({ scenario: 'mbx_list_nullmid', page: 1 })],
    queueRow: queue(),
    settings: { ...resolveSettings, resolve_max_pages: 1 },
  });
  assert.equal(evaluation.zero_match, true);
  assert.deepEqual(evaluation.matches, []);
});

test('T25 webhook Message-ID is checked against metadata and source', () => {
  const plan = planWorkerRoute({
    queueRow: {
      ...queue({
        uid: '910001',
        resolution_status: 'resolved',
        webhook_message_id: '<different@example.com>',
      }),
      hostinger_pointers: { mailbox_resource_id: 'mbx_mock', folder: 'INBOX', uid: '910001' },
    },
    settings: {
      ...resolveSettings,
      hostinger_mail_api_base_url: mockBase,
      hostinger_mail_api_allowed_hosts: ['mock.staging.invalid'],
    },
  });
  assert.equal(plan.route, 'fetch');
  const decided = decideFetchedIntake({
    plan,
    metadataItem: { statusCode: 200, body: JSON.stringify({ data: { messageId: '<different@example.com>', from: { address: 'pat@example.com' }, subject: 'Synthetic mock inquiry', to: [] } }) },
    textItem: { statusCode: 200, body: JSON.stringify({ data: { text: 'Hello', html: '' } }) },
    sourceItem: {
      statusCode: 200,
      data: [
        'Message-ID: <mock-910001@example.com>',
        'Date: Thu, 25 Sep 2026 14:00:00 +0000',
        'From: Pat Customer <pat@example.com>',
        'To: TVG <info@vent-guys.com>',
        'Subject: Synthetic mock inquiry',
        'Authentication-Results: mock.example; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com',
        '',
        'Hello',
      ].join('\r\n'),
    },
  });
  assert.equal(decided.decision.hold_reason, 'identity_uncertain');
  assert.equal(decided.decision.error_code, 'message_id_mismatch');
});

test('T26 whitespace is missing and a keyless Message-ID is invalid with no URL', () => {
  const whitespace = planFastAck(envelope({}, { messageId: '   ' }));
  assert.equal(whitespace.http_status, 200);
  assert.match(whitespace.sql, /NULL/);
  const missingPlan = planWorkerRoute({
    queueRow: queue({ webhook_message_id: null }),
    settings: resolveSettings,
  });
  assert.equal(missingPlan.hold_reason, 'message_id_missing');
  const invalidPlan = planWorkerRoute({
    queueRow: queue({ webhook_message_id: '<>' }),
    settings: resolveSettings,
  });
  assert.equal(invalidPlan.hold_reason, 'message_id_invalid');
  assert.equal(invalidPlan.metadata_url, null);
  const noAt = planWorkerRoute({
    queueRow: queue({ webhook_message_id: 'not-an-id' }),
    settings: resolveSettings,
  });
  assert.equal(noAt.hold_reason, 'message_id_invalid');
  assert.equal(midKey('<>'), null);
  assert.equal(midKey('not-an-id'), null);
});

test('T28 held message_id_missing is not resumed by re-resolve and a parked row is claimable', () => {
  const resume = readFileSync(join(root, 'apply/resume_deferred_kill_switch.sql'), 'utf8');
  assert.match(resume, /deferred_kill_switch/);
  assert.equal(resume.includes('message_id_missing'), false);
  const parked = planWorkerRoute({
    queueRow: queue({ status: 'pending', webhook_message_id: null, resolution_status: 'unresolved' }),
    settings: resolveSettings,
  });
  assert.equal(parked.hold_reason, 'message_id_missing');
  assert.equal(parked.metadata_url, null);
  assert.equal(manualReresolveAllowed(queue({
    status: 'held',
    hold_reason: 'message_id_missing',
    webhook_message_id: null,
  })), false);
});

test('T29 manual re-resolve allow and refuse list', () => {
  const sql = buildManualReresolveSql(QUEUE_ID);
  assert.match(sql, /resolve_attempts = 0/);
  assert.doesNotMatch(sql, /attempt_count\s*=/);
  assert.match(sql, /webhook_message_id IS NOT NULL/);
  for (const hold_reason of ['pointer_not_found', 'hostinger_rate_limited']) {
    assert.equal(manualReresolveAllowed(queue({ status: 'held', hold_reason, webhook_message_id: '<a@b.co>' })), true);
  }
  assert.equal(manualReresolveAllowed(queue({
    status: 'error',
    hold_reason: null,
    webhook_message_id: '<a@b.co>',
    last_error: 'hostinger_timeout',
  })), true);
  for (const hold_reason of [
    'message_id_missing',
    'message_id_invalid',
    'pointer_ambiguous',
    'identity_uncertain',
    'pointer_excluded_uid',
    'mailbox_map_changed',
  ]) {
    assert.equal(manualReresolveAllowed(queue({
      status: 'held',
      hold_reason,
      webhook_message_id: hold_reason === 'message_id_missing' ? null : '<a@b.co>',
    })), false, hold_reason);
  }
});

test('T30 both list envelope shapes parse and a bad page is malformed', () => {
  const rendered = renderMockListMessages({ scenario: 'mbx_list_hit1', page: 1 });
  const fromText = parseListEnvelope(asTextEnvelope(rendered));
  const fromBody = parseListEnvelope(asBodyEnvelope(rendered));
  assert.equal(fromText.ok, true);
  assert.equal(fromBody.ok, true);
  assert.equal(Array.isArray(fromText.items), true);
  const bad = evaluateResolvePages({
    pages: [renderMockListMessages({ scenario: 'mbx_list_badpage', page: 1 })],
    queueRow: queue(),
    settings: resolveSettings,
  });
  assert.equal(bad.error_code, 'resolve_response_malformed');
});

test('T31 resolved uid is what the fetch plan and outcome SQL use', () => {
  const pages = [renderMockListMessages({ scenario: 'mbx_list_hit1', page: 1 })];
  const row = queue({ webhook_message_id: '<mock-list@example.com>' });
  const evaluation = evaluateResolvePages({
    pages,
    queueRow: row,
    settings: { ...resolveSettings, resolve_max_pages: 1 },
  });
  assert.deepEqual(evaluation.matches, [3101]);
  const written = buildResolveWriteSql({ queueRow: row, settings: resolveSettings, evaluation });
  assert.match(written.sql, /3101::bigint/);
  const fetchPlan = planWorkerRoute({
    queueRow: {
      ...row,
      uid: '910001',
      resolution_status: 'resolved',
      hostinger_pointers: { mailbox_resource_id: 'mbx_mock', folder: 'INBOX', uid: '910001' },
    },
    settings: {
      ...resolveSettings,
      hostinger_mail_api_base_url: mockBase,
      hostinger_mail_api_allowed_hosts: ['mock.staging.invalid'],
    },
  });
  assert.equal(fetchPlan.route, 'fetch');
  assert.match(fetchPlan.metadata_url, /\/messages\/910001$/);
  assert.match(fetchPlan.text_url, /\/messages\/910001\/text$/);
  assert.match(fetchPlan.source_url, /\/messages\/910001\/source$/);
  const decided = decideFetchedIntake({
    plan: fetchPlan,
    metadataItem: { statusCode: 200, body: JSON.stringify(renderMockHostingerResponse({ uid: '910001', kind: 'metadata' }).response_body) },
    textItem: { statusCode: 200, body: JSON.stringify(renderMockHostingerResponse({ uid: '910001', kind: 'text' }).response_body) },
    sourceItem: { statusCode: 200, data: renderMockHostingerResponse({ uid: '910001', kind: 'source' }).response_body.data },
  });
  assert.match(decided.sql, /910001/);
  const worker = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-worker.json'), 'utf8'));
  const fetch = worker.nodes.find((node) => node.name === 'Fetch metadata');
  assert.equal(fetch.parameters.url.includes("$('Plan route')"), false);
  assert.match(fetch.parameters.url, /\$json\.metadata_url/);
});

test('T32 and T33 guard requires unresolved before a null Message-ID hold', () => {
  const missing = planWorkerRoute({
    queueRow: queue({ webhook_message_id: null, status: 'processing' }),
    settings: resolveSettings,
  });
  assert.equal(missing.hold_reason, 'message_id_missing');
  const sql = buildWorkerPointerHoldSql({ queue_id: QUEUE_ID, hold_reason: 'message_id_missing' });
  assert.match(sql, /resolution_status = 'unresolved'/);
  assert.match(sql, /webhook_message_id IS NULL/);
  assert.match(sql, /stage,\s*'worker'|'\s*worker\s*'/);
  assert.match(sql, /retryable/);
  assert.match(sql, /false/);
  assert.equal(sql.includes('SENTINEL_'), false);
  const legacy = planWorkerRoute({
    queueRow: queue({
      uid: '910001',
      resolution_status: 'legacy_pointer',
      webhook_message_id: null,
      hostinger_pointers: { mailbox_resource_id: 'mbx_mock', folder: 'INBOX', uid: '910001' },
    }),
    settings: {
      ...resolveSettings,
      hostinger_mail_api_base_url: mockBase,
      hostinger_mail_api_allowed_hosts: ['mock.staging.invalid'],
    },
  });
  assert.equal(legacy.route, 'fetch');
  const resolved = planWorkerRoute({
    queueRow: queue({
      uid: '910001',
      resolution_status: 'resolved',
      webhook_message_id: null,
      hostinger_pointers: { mailbox_resource_id: 'mbx_mock', folder: 'INBOX', uid: '910001' },
    }),
    settings: {
      ...resolveSettings,
      hostinger_mail_api_base_url: mockBase,
      hostinger_mail_api_allowed_hosts: ['mock.staging.invalid'],
    },
  });
  assert.equal(resolved.route, 'fetch');
});

test('mock list scenarios cover the packet cases', () => {
  assert.equal(renderMockListMessages({ scenario: 'mbx_list_hit3', page: 3 }).response_body.data[0].uid, 3303);
  assert.equal(renderMockListMessages({ scenario: 'mbx_list_ambiguous', page: 1 }).response_body.data.length, 2);
  assert.equal(renderMockListMessages({ scenario: 'mbx_list_delay', page: 1, attempt: 1 }).response_body.data[0].messageId.includes('mock-list'), false);
  assert.equal(renderMockListMessages({ scenario: 'mbx_list_delay', page: 1, attempt: 2 }).response_body.data[0].uid, 3601);
  assert.equal(renderMockListMessages({ scenario: 'mbx_list_429', page: 1 }).http_status, 429);
  assert.equal(renderMockListMessages({ scenario: 'mbx_list_timeout', page: 1 }).timeout, true);
  assert.equal(renderMockListMessages({ scenario: 'mbx_list_otherpath', page: 1 }).response_body.data[0].path, 'Sent');
  const mock = readFileSync(join(root, 'n8n/tvg-email-hostinger-mock.json'), 'utf8');
  for (const name of ['mbx_list_hit1', 'mbx_list_hit3', 'mbx_list_miss', 'mbx_list_collision']) {
    assert.equal(mock.includes(name), true, name);
  }
});

test('D9 timeout and upstream during resolution are errors, not the schedule', () => {
  for (const [scenario, code] of [['mbx_list_timeout', 'hostinger_timeout'], ['mbx_list_500', 'hostinger_upstream_error']]) {
    const evaluation = evaluateResolvePages({
      pages: [renderMockListMessages({ scenario, page: 1 })],
      queueRow: queue({ resolve_attempts: 0 }),
      settings: resolveSettings,
    });
    assert.equal(evaluation.error, true);
    assert.equal(evaluation.error_code, code);
    assert.equal(evaluation.retry, false);
    const written = buildResolveWriteSql({ queueRow: queue(), settings: resolveSettings, evaluation });
    assert.equal(written.outcome, 'error');
    assert.match(written.sql, new RegExp(code));
  }
});

test('six worker copies carry the new hold reasons', () => {
  const worker = JSON.parse(readFileSync(join(root, 'n8n/tvg-email-intake-worker.json'), 'utf8'));
  for (const name of ['Plan route', 'Re-guard GET', 'Normalize fetch', 'Closed hold', 'Evaluate', 'Plan internal SMS']) {
    const code = worker.nodes.find((node) => node.name === name).parameters.jsCode;
    for (const reason of [
      'mailbox_map_changed',
      'message_id_missing',
      'message_id_invalid',
      'pointer_not_found',
      'pointer_ambiguous',
      'pointer_excluded_uid',
      'resolve_response_malformed',
      'hostinger_rate_limited',
    ]) {
      assert.equal(code.includes(reason), true, `${name}:${reason}`);
    }
  }
});
