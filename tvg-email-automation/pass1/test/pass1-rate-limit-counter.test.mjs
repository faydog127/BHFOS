/**
 * Fast ACK stores hostinger_pointers.resolution as the JSON string "unresolved".
 * A 429 reschedule must turn that into an object counter, not a growing array.
 * Throwaway local Postgres only.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { planFastAck } from '../lib/pass1-intake-logic.mjs';
import { buildResolveWriteSql, rateLimitAction } from '../lib/pass1-hostinger-fetch.mjs';

const DB = 'tvg_pass1_429_7298';
const FAST_ACK_POINTERS = "jsonb_build_object('source', 'fast_ack_envelope_v2', 'resolution', 'unresolved')";
const SETTINGS = {
  resolve_max_pages: 3,
  resolve_lookback_hours: 48,
  resolve_max_attempts: 5,
  resolve_backoff_minutes: [1, 2, 5, 10, 20],
  resolve_429_max_consumed: 2,
};

function psql(sql) {
  return spawnSync('sudo', [
    '-u', 'postgres', 'psql', '-d', DB, '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A',
  ], { input: sql, encoding: 'utf8' });
}

function must(sql) {
  const result = psql(sql);
  assert.equal(result.status, 0, `psql failed:\n${result.stdout}\n${result.stderr}\nSQL:\n${sql.slice(0, 700)}`);
  return result.stdout.trim();
}

function recreate() {
  const drop = `
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname = '${DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${DB};
CREATE DATABASE ${DB};
`;
  const result = spawnSync('sudo', [
    '-u', 'postgres', 'psql', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-q',
  ], { input: drop, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function rateLimitedEval() {
  return {
    resolved: false,
    retry: true,
    matches: [],
    stop_reason: 'rate_limited',
    pages_scanned: 1,
    total: 0,
  };
}

function readRow(id) {
  const line = must(`
SELECT status::text
  || '|' || resolve_attempts::text
  || '|' || COALESCE(hold_reason, '')
  || '|' || COALESCE(jsonb_typeof(hostinger_pointers->'resolution'), 'missing')
  || '|' || COALESCE(hostinger_pointers->'resolution'->>'rate_limit_consumed', '')
  || '|' || COALESCE(hostinger_pointers->>'source', '')
  || '|' || COALESCE(hostinger_pointers::text, 'null')
  FROM email_automation.intake_queue
 WHERE id = '${id}'::uuid;
`);
  const [status, attempts, holdReason, resolutionType, consumed, source, pointersText] = line.split('|');
  const pointers = pointersText === 'null' ? null : JSON.parse(pointersText);
  return {
    status,
    resolve_attempts: Number(attempts),
    hold_reason: holdReason || null,
    resolutionType,
    consumed,
    source,
    hostinger_pointers: pointers,
  };
}

function apply429(id) {
  const row = readRow(id);
  const queueRow = {
    id,
    resolve_attempts: row.resolve_attempts,
    hostinger_pointers: row.hostinger_pointers,
  };
  const written = buildResolveWriteSql({
    queueRow,
    settings: SETTINGS,
    evaluation: rateLimitedEval(),
  });
  must(written.sql);
  return written;
}

test('a Fast ACK string resolution counts 429s up to the cap of 2', () => {
  const planned = planFastAck({
    id: '245ea272-c21e-548a-b9dd-fea1ee0230fd',
    event: 'message.received',
    timestamp: '2026-09-26T04:20:52.000Z',
    data: {
      eventId: '245ea272-c21e-548a-b9dd-fea1ee0230fd',
      mailboxAddress: 'info@vent-guys.com',
      messageId: '<rate-limit@example.com>',
    },
  });
  assert.equal(planned.sql.includes(FAST_ACK_POINTERS), true);

  recreate();
  assert.equal(must(`SELECT jsonb_typeof('"unresolved"'::jsonb || '{"rate_limit_consumed":1}'::jsonb);`), 'array');
  must(`
CREATE SCHEMA email_automation;
CREATE TYPE email_automation.intake_queue_status AS ENUM (
  'pending', 'processing', 'done', 'duplicate', 'error', 'held', 'deferred_kill_switch'
);
CREATE TABLE email_automation.intake_queue (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL DEFAULT 'tvg',
  status email_automation.intake_queue_status NOT NULL,
  resolve_attempts int NOT NULL DEFAULT 0,
  attempt_count int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  hold_reason text,
  last_error text,
  hostinger_pointers jsonb
);
CREATE TABLE email_automation.automation_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tvg',
  email_event_id uuid,
  intake_queue_id uuid,
  stage text NOT NULL,
  error_code text,
  error_message text NOT NULL,
  context_json jsonb DEFAULT '{}'::jsonb,
  retryable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
`);

  const fastId = '30000000-0000-4000-8000-0000000000a1';
  const plainId = '30000000-0000-4000-8000-0000000000a2';
  const objectId = '30000000-0000-4000-8000-0000000000a3';
  const nullId = '30000000-0000-4000-8000-0000000000a4';
  const missingId = '30000000-0000-4000-8000-0000000000a5';
  const absentId = '30000000-0000-4000-8000-0000000000a6';
  must(`
INSERT INTO email_automation.intake_queue (id, status, hostinger_pointers)
VALUES
  ('${fastId}', 'processing', ${FAST_ACK_POINTERS}),
  ('${plainId}', 'processing', ${FAST_ACK_POINTERS}),
  ('${objectId}', 'processing', '{"source":"kept","resolution":{"note":"stay"}}'::jsonb),
  ('${nullId}', 'processing', '{"source":"kept","resolution":null}'::jsonb),
  ('${missingId}', 'processing', '{"source":"kept"}'::jsonb),
  ('${absentId}', 'processing', NULL);
`);

  const seeded = readRow(fastId);
  assert.equal(seeded.resolutionType, 'string');
  assert.equal(seeded.source, 'fast_ack_envelope_v2');
  assert.equal(seeded.hostinger_pointers.resolution, 'unresolved');

  const first = apply429(fastId);
  assert.equal(first.outcome, 'rescheduled');
  const afterFirst = readRow(fastId);
  assert.equal(afterFirst.status, 'pending');
  assert.equal(afterFirst.resolve_attempts, 1);
  assert.equal(afterFirst.resolutionType, 'object');
  assert.equal(afterFirst.consumed, '1');
  assert.equal(afterFirst.source, 'fast_ack_envelope_v2');
  assert.equal(Array.isArray(afterFirst.hostinger_pointers.resolution), false);

  must(`UPDATE email_automation.intake_queue SET status = 'processing' WHERE id = '${fastId}'::uuid;`);
  const second = apply429(fastId);
  assert.equal(second.outcome, 'rescheduled');
  const afterSecond = readRow(fastId);
  assert.equal(afterSecond.resolve_attempts, 2);
  assert.equal(afterSecond.resolutionType, 'object');
  assert.equal(afterSecond.consumed, '2');
  assert.equal(Array.isArray(afterSecond.hostinger_pointers.resolution), false);

  must(`UPDATE email_automation.intake_queue SET status = 'processing' WHERE id = '${fastId}'::uuid;`);
  const thirdAction = rateLimitAction({
    resolve_attempts: afterSecond.resolve_attempts,
    hostinger_pointers: afterSecond.hostinger_pointers,
  }, SETTINGS);
  assert.equal(thirdAction.action, 'hold');
  assert.equal(thirdAction.error_code, 'hostinger_rate_limited');
  const third = buildResolveWriteSql({
    queueRow: {
      id: fastId,
      resolve_attempts: afterSecond.resolve_attempts,
      hostinger_pointers: afterSecond.hostinger_pointers,
    },
    settings: SETTINGS,
    evaluation: rateLimitedEval(),
  });
  assert.equal(third.outcome, 'held');
  assert.match(third.sql, /hostinger_rate_limited/);
  assert.doesNotMatch(third.sql, /rate_limit_consumed/);
  must(third.sql);
  const held = readRow(fastId);
  assert.equal(held.status, 'held');
  assert.equal(held.hold_reason, 'hostinger_rate_limited');
  assert.equal(held.resolve_attempts, 2);
  assert.equal(held.resolutionType, 'object');
  assert.equal(held.consumed, '2');
  assert.equal(must(`
SELECT error_code FROM email_automation.automation_errors WHERE intake_queue_id = '${fastId}'::uuid;
`), 'hostinger_rate_limited');

  const plain = buildResolveWriteSql({
    queueRow: {
      id: plainId,
      resolve_attempts: 0,
      hostinger_pointers: readRow(plainId).hostinger_pointers,
    },
    settings: SETTINGS,
    evaluation: {
      resolved: false,
      retry: true,
      matches: [],
      stop_reason: 'no_match',
      pages_scanned: 3,
      total: 0,
    },
  });
  assert.equal(plain.outcome, 'rescheduled');
  assert.doesNotMatch(plain.sql, /rate_limit_consumed/);
  assert.doesNotMatch(plain.sql, /hostinger_pointers/);
  must(plain.sql);
  const afterPlain = readRow(plainId);
  assert.equal(afterPlain.resolve_attempts, 1);
  assert.equal(afterPlain.resolutionType, 'string');
  assert.equal(afterPlain.hostinger_pointers.resolution, 'unresolved');
  assert.equal(afterPlain.source, 'fast_ack_envelope_v2');

  must(`UPDATE email_automation.intake_queue SET status = 'processing' WHERE id = '${objectId}'::uuid;`);
  apply429(objectId);
  const shaped = readRow(objectId);
  assert.equal(shaped.resolutionType, 'object');
  assert.deepEqual(shaped.hostinger_pointers.resolution, { note: 'stay', rate_limit_consumed: 1 });
  assert.equal(shaped.source, 'kept');

  for (const id of [nullId, missingId, absentId]) {
    must(`UPDATE email_automation.intake_queue SET status = 'processing' WHERE id = '${id}'::uuid;`);
    apply429(id);
    const row = readRow(id);
    assert.equal(row.resolutionType, 'object', id);
    assert.equal(row.consumed, '1', id);
    assert.equal(Array.isArray(row.hostinger_pointers.resolution), false, id);
  }
  assert.equal(readRow(nullId).source, 'kept');
  assert.equal(readRow(missingId).source, 'kept');
  assert.equal(readRow(absentId).source, '');
});
