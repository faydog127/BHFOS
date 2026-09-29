/**
 * M1–M8 and the SQL-backed T20/T22/T27/T29/T32/T34 checks.
 * Throwaway local Postgres only. Never a Supabase project.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { planFastAck } from '../lib/pass1-intake-logic.mjs';
import {
  buildManualReresolveSql,
  buildResolveWriteSql,
  buildWorkerPointerHoldSql,
  evaluateResolvePages,
  renderMockListMessages,
} from '../lib/pass1-hostinger-fetch.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = join(root, 'apply/20260929_tvg_email_pass1_pointer_contract.sql');
const rollbackPath = join(root, 'apply/20260929_tvg_email_pass1_pointer_contract_ROLLBACK.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');
const rollbackSql = readFileSync(rollbackPath, 'utf8');
const LATCH = "tvg_email_pass1.target_project = 'glkrykpksbsqmmilmjhs'";
const DB = 'tvg_ptr_contract_7298';
const DB_M1 = 'tvg_ptr_contract_7298_m1';

const STUB = `
CREATE SCHEMA IF NOT EXISTS email_automation;
DO $$ BEGIN
  CREATE TYPE email_automation.intake_queue_status AS ENUM (
    'pending', 'processing', 'done', 'duplicate', 'error', 'held', 'deferred_kill_switch'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE email_automation.automation_settings (
  tenant_id text NOT NULL DEFAULT 'tvg',
  key text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  PRIMARY KEY (tenant_id, key),
  CONSTRAINT automation_settings_tenant_tvg CHECK (tenant_id = 'tvg')
);
CREATE TABLE email_automation.intake_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'tvg',
  mailbox text NOT NULL,
  mailbox_resource_id text NOT NULL,
  folder text NOT NULL,
  uid bigint NOT NULL,
  message_id text,
  fallback_hash text,
  event_type text,
  status email_automation.intake_queue_status NOT NULL DEFAULT 'pending',
  attempt_count int NOT NULL DEFAULT 0,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  hold_reason text,
  hostinger_pointers jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_received_at timestamptz NOT NULL DEFAULT now(),
  email_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intake_queue_tenant_tvg CHECK (tenant_id = 'tvg')
);
CREATE UNIQUE INDEX uq_intake_queue_webhook_pointer
  ON email_automation.intake_queue (tenant_id, mailbox_resource_id, folder, uid);
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
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_errors_tenant_tvg CHECK (tenant_id = 'tvg')
);
COMMENT ON COLUMN email_automation.intake_queue.uid IS
  'Hostinger message UID as bigint. Locator only, not durable identity.';
`;

function psql(db, sql, { sets = [] } = {}) {
  const script = [...sets.map((item) => `SET ${item};`), sql].join('\n');
  return spawnSync('sudo', [
    '-u', 'postgres', 'psql', '-d', db, '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A',
  ], { input: script, encoding: 'utf8' });
}

function must(db, sql, sets = []) {
  const result = psql(db, sql, { sets });
  assert.equal(result.status, 0, `psql failed:\n${result.stdout}\n${result.stderr}\nSQL:\n${sql.slice(0, 500)}`);
  return result.stdout.trim();
}

function mustFail(db, sql, sets = []) {
  const result = psql(db, sql, { sets });
  assert.notEqual(result.status, 0, 'expected psql to fail');
  return `${result.stdout}\n${result.stderr}`;
}

function recreate(name) {
  const drop = `
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE datname = '${name}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${name};
CREATE DATABASE ${name};
`;
  const result = psql('postgres', drop);
  assert.equal(result.status, 0, result.stderr);
}

function columnExists(db, column) {
  const out = must(db, `
SELECT count(*) FROM information_schema.columns
 WHERE table_schema = 'email_automation' AND table_name = 'intake_queue' AND column_name = '${column}';
`);
  return out === '1';
}

function envelope({ eventId, envelopeId, messageId }) {
  const data = {
    eventId,
    mailboxAddress: 'info@vent-guys.com',
  };
  if (messageId !== undefined) data.messageId = messageId;
  return {
    event: 'message.received',
    id: envelopeId,
    timestamp: '2026-09-29T12:00:00.000Z',
    data,
  };
}

test('M1–M8 and SQL-backed pointer-contract checks on throwaway Postgres', () => {
  const rollbackExecutable = rollbackSql.replace(/--[^\n]*/g, '');
  const lockAt = rollbackExecutable.indexOf('LOCK TABLE email_automation.intake_queue IN ACCESS EXCLUSIVE MODE');
  const nullAt = rollbackExecutable.indexOf('WHERE uid IS NULL');
  const settingsLock = rollbackExecutable.indexOf('LOCK TABLE email_automation.automation_settings IN ACCESS EXCLUSIVE MODE');
  const deleteAt = rollbackExecutable.indexOf('DELETE FROM email_automation.automation_settings');
  assert.ok(lockAt > 0 && lockAt < nullAt, 'rollback locks intake_queue before the NULL uid check');
  assert.ok(settingsLock > nullAt && settingsLock < deleteAt, 'rollback locks automation_settings before the settings delete');
  assert.equal((migrationSql.match(/^BEGIN;/m) || []).length, 1);
  assert.equal((migrationSql.match(/^COMMIT;/m) || []).length, 1);
  assert.equal((rollbackSql.match(/^BEGIN;/m) || []).length, 1);
  assert.equal((rollbackSql.match(/^COMMIT;/m) || []).length, 1);
  assert.equal(/attempt_count\s*<=/.test(migrationSql.replace(/--[^\n]*/g, '')), false);

  recreate(DB_M1);
  must(DB_M1, STUB);
  const refused = mustFail(DB_M1, migrationSql);
  assert.match(refused, /refusing pointer-contract migration without the staging project latch/);
  assert.equal(columnExists(DB_M1, 'webhook_event_id'), false);
  assert.equal(columnExists(DB_M1, 'resolution_status'), false);
  must(DB_M1, "CREATE TABLE email_automation.email_responses (id int);");
  const refusedSend = mustFail(DB_M1, migrationSql, [LATCH]);
  assert.match(refusedSend, /customer send tables must not exist/);
  assert.equal(columnExists(DB_M1, 'webhook_event_id'), false);

  recreate(DB);
  must(DB, STUB);
  must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, status)
VALUES
  ('info@vent-guys.com', 'mbx_legacy', 'INBOX', 1001, 'done'),
  ('info@vent-guys.com', 'mbx_legacy', 'INBOX', 1002, 'pending');
`);
  must(DB, migrationSql, [LATCH]);
  must(DB, migrationSql, [LATCH]);
  const legacy = must(DB, `
SELECT count(*) FROM email_automation.intake_queue
 WHERE uid IN (1001, 1002) AND resolution_status = 'legacy_pointer' AND webhook_event_id IS NULL;
`);
  assert.equal(legacy, '2');
  must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, status)
VALUES ('info@vent-guys.com', 'mbx_legacy', 'INBOX', 1003, 'pending');
`);
  assert.equal(must(DB, `
SELECT resolution_status FROM email_automation.intake_queue WHERE uid = 1003;
`), 'legacy_pointer');

  must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, webhook_event_id, resolution_status, status)
VALUES
  ('info@vent-guys.com', 'mbx_open', 'INBOX', NULL, 'evt-null-uid-1', 'unresolved', 'pending'),
  ('info@vent-guys.com', 'mbx_open', 'INBOX', NULL, 'evt-null-uid-2', 'unresolved', 'pending');
`);
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue WHERE uid IS NULL;
`), '2');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue WHERE webhook_event_id IS NULL;
`), '3');

  const eventSql = planFastAck(envelope({
    eventId: 'evt-conflict',
    envelopeId: 'env-conflict',
    messageId: '<real-id@example.com>',
  })).sql;
  must(DB, `
UPDATE email_automation.automation_settings
   SET value_json = '{"info@vent-guys.com":"mbx_fast"}'::jsonb
 WHERE tenant_id = 'tvg' AND key = 'hostinger_mailbox_map';
INSERT INTO email_automation.automation_settings (tenant_id, key, value_json)
VALUES ('tvg', 'intake_processing_enabled', 'true'::jsonb);
`);
  must(DB, eventSql);
  must(DB, eventSql);
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue WHERE webhook_event_id = 'evt-conflict';
`), '1');
  must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, status, resolution_status)
VALUES ('info@vent-guys.com', 'mbx_legacy', 'INBOX', 1004, 'pending', 'legacy_pointer')
ON CONFLICT (tenant_id, mailbox_resource_id, folder, uid) DO NOTHING;
`);
  must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, status, resolution_status)
VALUES ('info@vent-guys.com', 'mbx_legacy', 'INBOX', 1004, 'pending', 'legacy_pointer')
ON CONFLICT (tenant_id, mailbox_resource_id, folder, uid) DO NOTHING;
`);
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue WHERE uid = 1004;
`), '1');

  must(DB, `
UPDATE email_automation.automation_settings
   SET value_json = '{}'::jsonb
 WHERE tenant_id = 'tvg' AND key = 'hostinger_mailbox_map';
`);
  const beforeEmpty = must(DB, 'SELECT count(*) FROM email_automation.intake_queue;');
  const empty = must(DB, planFastAck(envelope({
    eventId: 'evt-empty-map',
    envelopeId: 'env-empty-map',
    messageId: '<real-id@example.com>',
  })).sql);
  assert.equal(empty.split('|')[0], '0');
  assert.equal(must(DB, 'SELECT count(*) FROM email_automation.intake_queue;'), beforeEmpty);

  must(DB, `
UPDATE email_automation.automation_settings
   SET value_json = '{"info@vent-guys.com":"mbx_fast"}'::jsonb
 WHERE tenant_id = 'tvg' AND key = 'hostinger_mailbox_map';
`);
  const missingSql = planFastAck(envelope({
    eventId: 'evt-missing-mid',
    envelopeId: 'env-missing-mid',
  })).sql;
  const inserted = must(DB, missingSql);
  assert.equal(inserted.split('|')[0], '1');
  assert.match(inserted, /pending/);
  const missingRow = must(DB, `
SELECT status || '|' || COALESCE(hold_reason, '') || '|' || COALESCE(webhook_message_id, '')
     || '|' || resolution_status
  FROM email_automation.intake_queue WHERE webhook_event_id = 'evt-missing-mid';
`);
  assert.equal(missingRow, 'pending|||unresolved');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.automation_errors e
  JOIN email_automation.intake_queue q ON q.id = e.intake_queue_id
 WHERE q.webhook_event_id = 'evt-missing-mid';
`), '0');
  const missingId = must(DB, `
SELECT id FROM email_automation.intake_queue WHERE webhook_event_id = 'evt-missing-mid';
`);
  must(DB, `
UPDATE email_automation.intake_queue
   SET status = 'processing', locked_at = now(), locked_by = 'm7', attempt_count = attempt_count + 1
 WHERE id = '${missingId}'::uuid;
`);
  const holdSql = buildWorkerPointerHoldSql({ queue_id: missingId, hold_reason: 'message_id_missing' });
  assert.match(holdSql, /resolution_status = 'unresolved'/);
  assert.match(holdSql, /stage/);
  const held = must(DB, holdSql);
  assert.equal(held, missingId);
  const afterHold = must(DB, `
SELECT q.status || '|' || q.hold_reason || '|' || COALESCE(q.locked_at::text, '') || '|' || COALESCE(q.locked_by, '')
     || '|' || e.stage || '|' || e.retryable::text || '|' || e.error_code
  FROM email_automation.intake_queue q
  JOIN email_automation.automation_errors e ON e.intake_queue_id = q.id
 WHERE q.id = '${missingId}'::uuid;
`);
  assert.equal(afterHold, 'held|message_id_missing|||worker|false|message_id_missing');
  assert.equal(must(DB, holdSql), '');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.automation_errors WHERE intake_queue_id = '${missingId}'::uuid;
`), '1');

  const redeliver = planFastAck(envelope({
    eventId: 'evt-redeliver',
    envelopeId: 'env-redeliver',
  })).sql;
  must(DB, redeliver);
  must(DB, redeliver);
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue WHERE webhook_event_id = 'evt-redeliver';
`), '1');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.automation_errors e
  JOIN email_automation.intake_queue q ON q.id = e.intake_queue_id
 WHERE q.webhook_event_id = 'evt-redeliver';
`), '0');
  const redeliverId = must(DB, `
SELECT id FROM email_automation.intake_queue WHERE webhook_event_id = 'evt-redeliver';
`);
  must(DB, `
UPDATE email_automation.intake_queue
   SET status = 'processing', locked_at = now(), locked_by = 't27'
 WHERE id = '${redeliverId}'::uuid;
`);
  must(DB, buildWorkerPointerHoldSql({ queue_id: redeliverId, hold_reason: 'message_id_missing' }));
  must(DB, redeliver);
  assert.equal(must(DB, `
SELECT q.status || '|' || count(e.id)::text
  FROM email_automation.intake_queue q
  LEFT JOIN email_automation.automation_errors e ON e.intake_queue_id = q.id
 WHERE q.webhook_event_id = 'evt-redeliver'
 GROUP BY q.status;
`), 'held|1');

  const atomicId = must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, webhook_event_id, webhook_message_id,
   resolution_status, status, locked_at, locked_by)
VALUES
  ('info@vent-guys.com', 'mbx_fast', 'INBOX', NULL, 'evt-atomic', NULL,
   'unresolved', 'processing', now(), 't34')
RETURNING id;
`);
  must(DB, `
CREATE OR REPLACE FUNCTION email_automation._test_fail_error() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'forced error insert failure';
END
$fn$;
CREATE TRIGGER trg_fail_error
  BEFORE INSERT ON email_automation.automation_errors
  FOR EACH ROW EXECUTE FUNCTION email_automation._test_fail_error();
`);
  const forced = mustFail(DB, buildWorkerPointerHoldSql({
    queue_id: atomicId,
    hold_reason: 'message_id_missing',
  }));
  assert.match(forced, /forced error insert failure/);
  assert.equal(must(DB, `
SELECT status || '|' || COALESCE(hold_reason, '') || '|' || COALESCE(locked_by, '')
  FROM email_automation.intake_queue WHERE id = '${atomicId}'::uuid;
`), 'processing||t34');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.automation_errors WHERE intake_queue_id = '${atomicId}'::uuid;
`), '0');
  must(DB, 'DROP TRIGGER trg_fail_error ON email_automation.automation_errors;');
  must(DB, buildWorkerPointerHoldSql({ queue_id: atomicId, hold_reason: 'message_id_missing' }));
  assert.equal(must(DB, buildWorkerPointerHoldSql({
    queue_id: atomicId,
    hold_reason: 'message_id_missing',
  })), '');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.automation_errors WHERE intake_queue_id = '${atomicId}'::uuid;
`), '1');

  const scheduleId = must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, webhook_event_id, webhook_message_id,
   resolution_status, status, resolve_attempts, attempt_count, locked_at, locked_by)
VALUES
  ('info@vent-guys.com', 'mbx_fast', 'INBOX', NULL, 'evt-schedule', '<real-id@example.com>',
   'unresolved', 'processing', 2, 11, now(), 't22')
RETURNING id;
`);
  const rescheduled = buildResolveWriteSql({
    queueRow: {
      id: scheduleId,
      resolve_attempts: 2,
      attempt_count: 11,
      webhook_message_id: '<real-id@example.com>',
      hostinger_pointers: {},
    },
    settings: { resolve_backoff_minutes: [1, 2, 5, 10, 20], resolve_max_attempts: 5 },
    evaluation: evaluateResolvePages({
      pages: [1, 2, 3].map((page) => renderMockListMessages({ scenario: 'mbx_list_miss', page })),
      queueRow: {
        id: scheduleId,
        resolve_attempts: 2,
        webhook_message_id: '<real-id@example.com>',
        webhook_event_at: '2026-09-29T12:00:00.000Z',
      },
      settings: { resolve_max_pages: 3, resolve_lookback_hours: 48, resolve_max_attempts: 5 },
    }),
  });
  assert.equal(rescheduled.outcome, 'rescheduled');
  must(DB, rescheduled.sql);
  assert.equal(must(DB, `
SELECT status || '|' || resolve_attempts::text || '|' || attempt_count::text
     || '|' || COALESCE(locked_at::text, '') || '|' || COALESCE(locked_by, '')
  FROM email_automation.intake_queue WHERE id = '${scheduleId}'::uuid;
`), 'pending|3|11||');

  must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, resolution_status, status)
VALUES ('info@vent-guys.com', 'mbx_fast', 'INBOX', 3101, 'legacy_pointer', 'done');
`);
  const collideId = must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, webhook_event_id, webhook_message_id,
   resolution_status, status, locked_at, locked_by)
VALUES
  ('info@vent-guys.com', 'mbx_fast', 'INBOX', NULL, 'evt-collide', '<mock-list@example.com>',
   'unresolved', 'processing', now(), 't20')
RETURNING id;
`);
  assert.equal(must(DB, `
SELECT email_automation.resolve_intake_uid('${collideId}'::uuid, 3101, 1, 1);
`), 'duplicate');
  assert.equal(must(DB, `
SELECT status || '|' || resolution_status || '|' || COALESCE(uid::text, '')
  FROM email_automation.intake_queue WHERE id = '${collideId}'::uuid;
`), 'duplicate|unresolved|');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.automation_errors WHERE intake_queue_id = '${collideId}'::uuid;
`), '0');

  must(DB, `
CREATE UNIQUE INDEX uq_test_resolved_mailbox
  ON email_automation.intake_queue (tenant_id, mailbox)
  WHERE resolution_status = 'resolved';
`);
  must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, resolution_status, status)
VALUES ('other@vent-guys.com', 'mbx_other_owner', 'INBOX', 88001, 'resolved', 'done');
`);
  const otherId = must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, webhook_event_id, webhook_message_id,
   resolution_status, status)
VALUES
  ('other@vent-guys.com', 'mbx_other_new', 'INBOX', NULL, 'evt-other-unique', '<other@example.com>',
   'unresolved', 'processing')
RETURNING id;
`);
  const otherFail = mustFail(DB, `
SELECT email_automation.resolve_intake_uid('${otherId}'::uuid, 88002, 1, 1);
`);
  assert.match(otherFail, /uq_test_resolved_mailbox/);
  assert.equal(must(DB, `
SELECT status || '|' || resolution_status || '|' || COALESCE(uid::text, '')
  FROM email_automation.intake_queue WHERE id = '${otherId}'::uuid;
`), 'processing|unresolved|');

  const allowedId = must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, webhook_event_id, webhook_message_id,
   resolution_status, status, hold_reason, resolve_attempts, attempt_count)
VALUES
  ('info@vent-guys.com', 'mbx_fast', 'INBOX', NULL, 'evt-reresolve', '<real-id@example.com>',
   'unresolved', 'held', 'pointer_not_found', 5, 9)
RETURNING id;
`);
  const refusedId = must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, webhook_event_id, webhook_message_id,
   resolution_status, status, hold_reason)
VALUES
  ('info@vent-guys.com', 'mbx_fast', 'INBOX', NULL, 'evt-refuse-missing', NULL,
   'unresolved', 'held', 'message_id_missing')
RETURNING id;
`);
  assert.equal(must(DB, buildManualReresolveSql(refusedId)), '');
  const reset = must(DB, buildManualReresolveSql(allowedId));
  assert.match(reset, new RegExp(`${allowedId}\\|pending\\|0\\|9`));
  assert.equal(must(DB, `
SELECT status FROM email_automation.intake_queue WHERE id = '${refusedId}'::uuid;
`), 'held');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue
 WHERE id = '${allowedId}'::uuid AND status = 'pending' AND resolve_attempts = 0 AND attempt_count = 9;
`), '1');

  const holder = spawn('sudo', [
    '-u', 'postgres', 'psql', '-d', DB, '-X', '-v', 'ON_ERROR_STOP=1', '-q',
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  holder.stdin.write('BEGIN;\nLOCK TABLE email_automation.intake_queue IN ROW SHARE MODE;\n');
  const deadline = Date.now() + 5000;
  let heldLock = false;
  while (Date.now() < deadline) {
    const seen = psql(DB, `
SELECT count(*) FROM pg_locks l
  JOIN pg_class c ON c.oid = l.relation
 WHERE c.relname = 'intake_queue' AND l.mode = 'RowShareLock';
`);
    if (seen.stdout.trim() !== '' && seen.stdout.trim() !== '0') {
      heldLock = true;
      break;
    }
    spawnSync('sleep', ['0.1']);
  }
  assert.equal(heldLock, true, holder.stderr?.read?.()?.toString?.() || 'row share lock was not observed');
  const blocked = mustFail(DB, rollbackSql, [`lock_timeout = '1s'`, LATCH]);
  assert.match(blocked, /lock timeout|canceling statement due to lock timeout/i);
  assert.doesNotMatch(blocked, /rollback refused/);
  assert.equal(columnExists(DB, 'resolution_status'), true);
  holder.stdin.write('COMMIT;\n\\q\n');
  holder.stdin.end();

  const refusedRollback = mustFail(DB, rollbackSql, [LATCH]);
  assert.match(refusedRollback, /rollback refused: rows with NULL uid exist/);
  assert.equal(columnExists(DB, 'webhook_message_id'), true);
  assert.equal(must(DB, `
SELECT count(*) FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'email_automation' AND p.proname = 'resolve_intake_uid';
`), '1');

  must(DB, 'DELETE FROM email_automation.intake_queue WHERE uid IS NULL;');
  must(DB, rollbackSql, [LATCH]);
  assert.equal(columnExists(DB, 'webhook_event_id'), false);
  assert.equal(columnExists(DB, 'resolution_status'), false);
  assert.equal(columnExists(DB, 'resolve_attempts'), false);
  assert.equal(must(DB, `
SELECT is_nullable FROM information_schema.columns
 WHERE table_schema = 'email_automation' AND table_name = 'intake_queue' AND column_name = 'uid';
`), 'NO');
  assert.equal(must(DB, `
SELECT count(*) FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'email_automation' AND p.proname = 'resolve_intake_uid';
`), '0');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.automation_settings
 WHERE key IN ('hostinger_mailbox_map','resolve_max_pages','resolve_lookback_hours',
               'resolve_max_attempts','resolve_backoff_minutes','resolve_429_max_consumed');
`), '0');
  assert.match(must(DB, `
SELECT col_description('email_automation.intake_queue'::regclass,
  (SELECT attnum FROM pg_attribute
    WHERE attrelid = 'email_automation.intake_queue'::regclass AND attname = 'uid'));
`), /Locator only, not durable identity/);
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue WHERE uid IS NOT NULL;
`), '6');
});
