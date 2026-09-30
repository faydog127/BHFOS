/**
 * n8n carries Code-node SQL to Postgres with JavaScript string replacement.
 * $$ $& $` $' and, when the matcher has a capture, $n are rewritten first.
 * The live Fast ACK failure was $' inside ~ '^[A-Za-z0-9_-]{1,128}$'.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildFastPathInsertSql,
  buildGapFillSql,
  buildOutcomeSql,
  normalizeWebhookPointer,
  planFastAck,
  quoteLiteral,
} from '../lib/pass1-intake-logic.mjs';
import {
  buildClosedHoldSql,
  buildManualReresolveSql,
  buildResolveWriteSql,
  buildWorkerPointerHoldSql,
} from '../lib/pass1-hostinger-fetch.mjs';
import { buildNotificationInsertSql } from '../lib/pass1-internal-sms.mjs';
import {
  buildHealthAlertSql,
  buildHealthOutageSql,
  buildHealthSuccessSql,
} from '../lib/pass1-ops-policy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const n8nDir = join(root, 'n8n');
const QUEUE = '30000000-0000-4000-8000-0000000000aa';
const EVENT = '30000000-0000-4000-8000-0000000000bb';

const OLD_MAILBOX_PREDICATE = "~ '^[A-Za-z0-9_-]{1,128}$'";
const NEW_MAILBOX_PREDICATE = "~ ('^[A-Za-z0-9_-]{1,128}' || chr(36))";
const RISKY = /\$\$|\$&|\$'|\$`|\$\d/;

const EXPRESSION_QUERIES = new Set([
  '={{ $json.sql }}',
  "={{ $json.sql || 'SELECT 1 WHERE false' }}",
  "={{ $json.summarySql || 'SELECT 1 WHERE false' }}",
  "={{ $json.sample_sql || 'SELECT 1 WHERE false' }}",
  "={{ $json.alertSql || 'SELECT 1 WHERE false' }}",
  "={{ $json.stateSql || 'SELECT 1 WHERE false' }}",
]);

function expressionTransport(sql, regex) {
  return '={{ $json.sql }}'.replace(regex, sql);
}

function assertTransportSafe(sql, label) {
  assert.equal(typeof sql, 'string', label);
  assert.equal(sql.includes('$'), false, `${label} still contains $`);
  assert.equal(RISKY.test(sql), false, label);
  assert.equal(expressionTransport(sql, /=\{\{[\s\S]*\}\}/), sql, `${label} no-capture`);
  assert.equal(expressionTransport(sql, /=\{\{([\s\S]*)\}\}/), sql, `${label} capture`);
}

function envelope(messageId) {
  return {
    id: '245ea272-c21e-548a-b9dd-fea1ee0230fd',
    event: 'message.received',
    timestamp: '2026-09-26T04:20:52.000Z',
    data: {
      eventId: '245ea272-c21e-548a-b9dd-fea1ee0230fd',
      mailboxAddress: 'info@vent-guys.com',
      messageId,
    },
  };
}

const resolveSettings = {
  resolve_max_pages: 3,
  resolve_lookback_hours: 48,
  resolve_max_attempts: 5,
  resolve_backoff_minutes: [1, 2, 5, 10, 20],
  resolve_429_max_consumed: 2,
};

function outcomeSql(extra) {
  return buildOutcomeSql({
    queue_id: QUEUE,
    event_status: 'awaiting_pass2',
    queue_status: 'done',
    message_id: 'synth-pass1-f1@vent-guys.test',
    fallback_hash: null,
    mailbox: 'info@vent-guys.com',
    mailbox_resource_id: 'mbx_synth',
    folder: 'INBOX',
    uid: '42',
    body_hash: 'ab'.repeat(32),
    spf_pass: true,
    dkim_pass: true,
    dmarc_pass: true,
    ...extra,
  });
}

function generatedSqlFixtures() {
  const pointer = normalizeWebhookPointer({
    mailboxResourceId: 'mbx_synth',
    folder: 'INBOX',
    uid: 42,
    mailbox: 'info@vent-guys.com',
    event: 'message.received',
  });
  const dollarMessage = ['<id', '$', "'", '$$', '$&', '$`', '$1', '$12', 'end$', '@example.com>'].join('');
  const fastClean = planFastAck(envelope('<synth-pass1@example.com>'));
  const fastBlank = planFastAck(envelope('   '));
  const fastDollar = planFastAck(envelope(dollarMessage));
  const alert = {
    kind: 'health_outage',
    incidentKey: 'primary_path:2026-09-30T00:00:00.000Z',
    component: 'primary_path',
    smsText: 'TVG: Email automation down — review. Component: primary_path. No reply sent by automation.',
  };
  const rows = [
    ['fast-ack clean', fastClean.sql],
    ['fast-ack blank message id', fastBlank.sql],
    ['fast-ack dollar message id', fastDollar.sql],
    ['fast-path insert', buildFastPathInsertSql(pointer, { killSwitchEnabled: false })],
    ['gap fill', buildGapFillSql([{
      mailbox: 'info@vent-guys.com',
      mailboxResourceId: 'mbx_synth',
      folder: 'INBOX',
      uid: '77',
    }])],
    ['outcome clean', outcomeSql({})],
    ['outcome dollar fields', outcomeSql({
      message_id: dollarMessage,
      subject: "Invoice $5 $$ $& $' $` $1",
      body_excerpt: "tail$",
      from_email: 'a$b@example.com',
      in_reply_to: '<prior$@example.com>',
      references_header: '<one$@example.com> <two$$@example.com>',
      attachment_meta: [{ filename: 'quote$.pdf', content_type: 'application/pdf', size_bytes: 12 }],
      fetch_base_url: 'https://mock.example/base$',
      fetch_mode: 'mock$',
    })],
    ['closed hold', buildClosedHoldSql({
      queue_id: QUEUE,
      queue_status: 'held',
      hold_reason: 'pointer_unresolved',
      error_code: 'pointer_unresolved',
      detail: "hostinger$'$$",
      fetch_base_url: 'disabled',
    })],
    ['pointer hold', buildWorkerPointerHoldSql({ queue_id: QUEUE, hold_reason: 'message_id_missing' })],
    ['manual reresolve', buildManualReresolveSql(QUEUE)],
    ['resolve matched', buildResolveWriteSql({
      queueRow: { id: QUEUE, resolve_attempts: 0, hostinger_pointers: {} },
      settings: resolveSettings,
      evaluation: { resolved: true, matches: [4101], pages_scanned: 1, total: 1 },
    }).sql],
    ['resolve reschedule', buildResolveWriteSql({
      queueRow: { id: QUEUE, resolve_attempts: 0, hostinger_pointers: {} },
      settings: resolveSettings,
      evaluation: { resolved: false, retry: true, matches: [], stop_reason: 'no_match', pages_scanned: 1, total: 0 },
    }).sql],
    ['resolve hold', buildResolveWriteSql({
      queueRow: { id: QUEUE, resolve_attempts: 5, hostinger_pointers: {} },
      settings: resolveSettings,
      evaluation: { resolved: false, retry: true, matches: [], stop_reason: 'no_match', pages_scanned: 1, total: 0 },
    }).sql],
    ['notification actionable', buildNotificationInsertSql({
      action: 'record_only',
      kind: 'actionable_inbound',
      emailEventId: EVENT,
      status: 'awaiting_pass2',
      deliveryState: 'recorded_not_sent',
      suppressionReason: 'credential_not_approved',
      smsText: "TVG: cost is $5 $$ $& $' $` $1. No reply sent by automation.",
      destinationRef: 'founder_mobile_ref',
    })],
    ['notification storm', buildNotificationInsertSql({
      action: 'suppress',
      kind: 'storm_summary',
      destinationRef: 'founder_mobile_ref',
      suppressionWindow: '2026-09-30T00',
      smsText: 'TVG: 2 additional new emails received — review queue.',
    })],
    ['notification backlog', buildNotificationInsertSql({
      action: 'record_only',
      kind: 'backlog_summary',
      destinationRef: 'founder_mobile_ref',
      suppressionWindow: '2026-09-30',
      smsText: 'TVG: 2 emails were already queued before live notifications — review backlog.',
    })],
    ['health alert', buildHealthAlertSql(alert, 'founder_mobile_ref')],
    ['health alert dollar window', buildHealthAlertSql({
      ...alert,
      incidentKey: "primary_path$'$$",
      smsText: "TVG: $' $$ $& $` $1. No reply sent by automation.",
    }, 'founder_mobile_ref')],
    ['health success', buildHealthSuccessSql('primary_path')],
    ['health outage', buildHealthOutageSql('primary_path', "inc$'1", 'down')],
  ];
  assert.equal(fastClean.sample_sql, null);
  assert.equal(fastBlank.sql.includes('NULL'), true);
  return rows;
}

test('the historical mailbox regex is eaten by expression replacement', () => {
  const historical = "SELECT 'abc' ~ '^[A-Za-z0-9_-]{1,128}$' AS ok;";
  const eaten = expressionTransport(historical, /=\{\{[\s\S]*\}\}/);
  assert.equal(eaten, "SELECT 'abc' ~ '^[A-Za-z0-9_-]{1,128} AS ok;");
  const captured = expressionTransport("SELECT '$1' AS v;", /=\{\{([\s\S]*)\}\}/);
  assert.equal(captured, "SELECT ' $json.sql ' AS v;");
  const doubled = expressionTransport("SELECT '$$' AS v;", /=\{\{[\s\S]*\}\}/);
  assert.equal(doubled, "SELECT '$' AS v;");
});

test('generated SQL from the Pass 1 builders survives n8n expression transport', () => {
  const fixtures = generatedSqlFixtures();
  assert.ok(fixtures.length >= 20);
  for (const [label, sql] of fixtures) {
    assertTransportSafe(sql, label);
    assert.equal(sql.includes(OLD_MAILBOX_PREDICATE), false, label);
  }
  const fast = fixtures.find(([label]) => label === 'fast-ack clean')[1];
  assert.equal(fast.split(NEW_MAILBOX_PREDICATE).length - 1, 2);
  assert.match(fast, /'INBOX'/);
  assert.match(fast, /\n {4}NULL,\n {4}'/);
  assert.match(fast, /webhook_event_id/);
  assert.match(fast, /ON CONFLICT \(tenant_id, webhook_event_id\)/);
  const reresolve = fixtures.find(([label]) => label === 'manual reresolve')[1];
  assert.match(reresolve, /hostinger_timeout\|hostinger_upstream_error/);
  assert.equal(reresolve.includes('$'), false);
});

test('quoteLiteral leaves ordinary text unchanged and emits chr(36) for dollars', () => {
  assert.equal(quoteLiteral(null), 'NULL');
  assert.equal(quoteLiteral(undefined), 'NULL');
  assert.equal(quoteLiteral(12), '12');
  assert.equal(quoteLiteral(false), 'FALSE');
  assert.equal(quoteLiteral("O'Brien"), "'O''Brien'");
  assert.equal(quoteLiteral('a$b'), "('a' || chr(36) || 'b')");
  assert.equal(quoteLiteral('$'), "('' || chr(36) || '')");
  assert.equal(quoteLiteral('a$$b'), "('a' || chr(36) || '' || chr(36) || 'b')");
  assert.equal(quoteLiteral("a$'b"), "('a' || chr(36) || '''b')");
  assert.equal(quoteLiteral('end$'), "('end' || chr(36) || '')");
  assert.throws(() => quoteLiteral('a\u0000b'), /NUL/);
});

function psql(sql) {
  const result = spawnSync('sudo', ['-u', 'postgres', 'psql', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stderr}\n${sql}`);
  return result.stdout.trim();
}

test('chr(36) literals and the mailbox predicate match on PostgreSQL 16', () => {
  const samples = [
    'a$b',
    '$',
    '$$',
    "$'",
    '$&',
    '$`',
    '$1',
    '$12',
    'end$',
    "O'Brien $5",
    ['a', '$', "'", '$$', '$&', '$`', '$99', 'z'].join(''),
  ];
  for (const sample of samples) {
    const sqlText = quoteLiteral(sample);
    assert.equal(sqlText.includes('$'), false, sample);
    const tag = 'exp';
    assert.equal(sample.includes(`$${tag}$`), false);
    assert.equal(psql(`SELECT (${sqlText}) = $${tag}$${sample}$${tag}$;`), 't', sample);
  }
  const bareCast = spawnSync('sudo', ['-u', 'postgres', 'psql', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', '-c', `SELECT '{"k":"a' || chr(36) || 'b"}'::jsonb;`], { encoding: 'utf8' });
  assert.notEqual(bareCast.status, 0);
  assert.match(bareCast.stderr, /invalid input syntax for type json/);
  assert.equal(psql(String.raw`SELECT (('{"k":"a' || chr(36) || 'b"}')::jsonb ->> 'k');`), 'a$b');

  const corpus = [
    null,
    '',
    'a',
    'A',
    'z',
    '0',
    '9',
    '_',
    '-',
    '-a',
    'a-',
    'A_b-9',
    'a'.repeat(128),
    'a'.repeat(129),
    '.',
    ' ',
    '/',
    '$',
    "'",
    'é',
    '😀',
    'a\nb',
    'abc\n',
    '\n',
    'a b',
    'AC8c52a994840722513e7cf775afb3',
  ];
  const values = corpus.map((value) => `(${value === null ? 'NULL::text' : `$mbx$${value}$mbx$`})`).join(', ');
  const disagree = psql(`
    SELECT count(*)
    FROM (VALUES ${values}) AS t(v)
    WHERE (v ~ '^[A-Za-z0-9_-]{1,128}$') IS DISTINCT FROM
          (v ~ ('^[A-Za-z0-9_-]{1,128}' || chr(36)));
  `);
  assert.equal(disagree, '0');
  assert.equal(psql(`
    SELECT (NULL::text ~ '^[A-Za-z0-9_-]{1,128}$') IS NULL
       AND (NULL::text ~ ('^[A-Za-z0-9_-]{1,128}' || chr(36))) IS NULL;
  `), 't');
  const accepted = psql(`
    SELECT string_agg(v, ',' ORDER BY v COLLATE "C")
    FROM (VALUES ${values}) AS t(v)
    WHERE v ~ ('^[A-Za-z0-9_-]{1,128}' || chr(36));
  `);
  assert.equal(accepted, [
    '-',
    '-a',
    '0',
    '9',
    'A',
    'AC8c52a994840722513e7cf775afb3',
    'A_b-9',
    '_',
    'a',
    'a-',
    'a'.repeat(128),
    'z',
  ].join(','));
});

test('expression-path Postgres nodes carry no risky SQL, and Claim pending stays a literal', () => {
  const files = readdirSync(n8nDir).filter((name) => name.endsWith('.json')).sort();
  const literalRisky = [];
  const expressionNodes = [];
  for (const file of files) {
    const text = readFileSync(join(n8nDir, file), 'utf8');
    const workflow = JSON.parse(text);
    assert.equal(text.includes(OLD_MAILBOX_PREDICATE), false, file);
    for (const node of workflow.nodes) {
      if (node.type !== 'n8n-nodes-base.postgres') continue;
      const query = node.parameters.query;
      if (query.startsWith('=')) {
        assert.equal(RISKY.test(query), false, `${file} ${node.name}`);
        assert.equal(EXPRESSION_QUERIES.has(query), true, `${file} ${node.name} ${query}`);
        expressionNodes.push(`${file} ${node.name}`);
      } else if (RISKY.test(query)) {
        literalRisky.push(`${file} ${node.name}`);
      }
    }
  }
  assert.deepEqual(expressionNodes, [
    'tvg-email-health-heartbeat.json Record health alert',
    'tvg-email-health-heartbeat.json Record health state',
    'tvg-email-intake-fast-ack.json Insert pointer',
    'tvg-email-intake-fast-ack.json Auth sample disconnected',
    'tvg-email-intake-worker.json Commit resolve',
    'tvg-email-intake-worker.json Write outcome',
    'tvg-email-intake-worker.json Record notification',
    'tvg-email-intake-worker.json Record notification summary',
  ]);
  assert.deepEqual(literalRisky, [
    'tvg-email-intake-worker.json Claim pending',
  ]);
  const claim = JSON.parse(readFileSync(join(n8nDir, 'tvg-email-intake-worker.json'), 'utf8'))
    .nodes.find((node) => node.name === 'Claim pending');
  assert.equal(claim.parameters.query.startsWith('='), false);
  assert.match(claim.parameters.query, /ex\.uid_text ~ '\^\[0-9\]\{1,18\}\$'/);
});
