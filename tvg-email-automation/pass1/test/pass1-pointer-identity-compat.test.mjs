/**
 * Staging identity compatibility.
 * Starts from the recorded 20260927 migration, then the 20260929 pointer
 * contract, then the compat migration. Throwaway local Postgres only.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { planFastAck } from '../lib/pass1-intake-logic.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const identitySql = readFileSync(join(root, 'apply/20260927_tvg_hostinger_webhook_identity.sql'), 'utf8');
const migrationSql = readFileSync(join(root, 'apply/20260929_tvg_email_pass1_pointer_contract.sql'), 'utf8');
const compatSql = readFileSync(join(root, 'apply/20260929b_tvg_email_pass1_pointer_identity_compat.sql'), 'utf8');
const rollbackSql = readFileSync(join(root, 'apply/20260929_tvg_email_pass1_pointer_contract_ROLLBACK.sql'), 'utf8');
const LATCH = "tvg_email_pass1.target_project = 'glkrykpksbsqmmilmjhs'";
const DB = 'tvg_ptr_identity_compat_7298';
const DB_REFUSE = 'tvg_ptr_identity_compat_refuse_7298';

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
COMMENT ON COLUMN email_automation.intake_queue.uid IS
  'Hostinger message UID as bigint. Locator only — not durable identity.';
`;

const SNAPSHOT = `
SELECT 'column|' || column_name || '|' || is_nullable || '|' || data_type
       || '|' || COALESCE(column_default, '')
  FROM information_schema.columns
 WHERE table_schema = 'email_automation' AND table_name = 'intake_queue'
 ORDER BY column_name;
SELECT 'constraint|' || c.conname || '|' || pg_get_constraintdef(c.oid)
  FROM pg_constraint c
 WHERE c.conrelid = 'email_automation.intake_queue'::regclass
 ORDER BY c.conname;
SELECT 'index|' || indexname || '|' || indexdef
  FROM pg_indexes
 WHERE schemaname = 'email_automation' AND tablename = 'intake_queue'
 ORDER BY indexname;
SELECT 'comment|' || a.attname || '|' || COALESCE(col_description(a.attrelid, a.attnum), '')
  FROM pg_attribute a
 WHERE a.attrelid = 'email_automation.intake_queue'::regclass
   AND a.attnum > 0 AND NOT a.attisdropped
 ORDER BY a.attname;
SELECT 'setting|' || key || '|' || value_json::text
  FROM email_automation.automation_settings
 WHERE tenant_id = 'tvg'
 ORDER BY key;
SELECT 'function|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'email_automation'
 ORDER BY 1;
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

function received({ eventId, messageId }) {
  const data = {
    eventId,
    mailboxAddress: 'info@vent-guys.com',
  };
  if (messageId !== undefined) data.messageId = messageId;
  return {
    event: 'message.received',
    id: eventId,
    timestamp: '2026-09-29T12:00:00.000Z',
    data,
  };
}

test('20260927 then pointer contract then compat, and rollback restores that schema', () => {
  const rollbackExecutable = rollbackSql.replace(/--[^\n]*/g, '');
  assert.equal(/SET\s+NOT\s+NULL/i.test(rollbackExecutable), false);
  assert.match(rollbackExecutable, /webhook_message_id IS NOT NULL/);
  assert.equal(rollbackExecutable.includes('DROP COLUMN IF EXISTS webhook_message_id'), false);
  assert.match(compatSql, /webhook_event_id IS NOT NULL/);
  assert.match(compatSql, /SET LOCAL lock_timeout = '5s';/);

  recreate(DB);
  must(DB, STUB);
  must(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, status)
VALUES
  ('info@vent-guys.com', 'mbx_legacy', 'INBOX', 1001, 'done'),
  ('info@vent-guys.com', 'mbx_legacy', 'INBOX', 1002, 'pending');
`);
  must(DB, identitySql);
  must(DB, `
INSERT INTO email_automation.automation_settings (tenant_id, key, value_json)
VALUES ('tvg', 'intake_processing_enabled', 'true'::jsonb);
`);
  const before = must(DB, SNAPSHOT);
  assert.match(before, /column\|uid\|YES\|bigint/);
  assert.match(before, /column\|folder\|YES\|text/);
  assert.match(before, /column\|webhook_message_id\|YES\|text/);
  assert.equal(before.includes('webhook_event_id|'), false);
  assert.match(before, /intake_queue_pointer_or_webhook_identity\|CHECK \(.*\(folder IS NULL\) = \(uid IS NULL\).*webhook_message_id IS NOT NULL/);
  assert.match(before, /uq_intake_queue_webhook_message/);
  assert.match(before, /uq_intake_queue_webhook_pointer/);
  assert.match(before, /Exact RFC Message-ID from an authenticated webhook/);

  must(DB, migrationSql, [LATCH]);
  must(DB, `
UPDATE email_automation.automation_settings
   SET value_json = '{"info@vent-guys.com":"mbx_fast"}'::jsonb
 WHERE tenant_id = 'tvg' AND key = 'hostinger_mailbox_map';
`);
  const beforeCompat = mustFail(DB, planFastAck(received({
    eventId: 'evt-ordinary',
    messageId: '<ordinary@example.com>',
  })).sql);
  assert.match(beforeCompat, /intake_queue_pointer_or_webhook_identity/);

  const refusedCompat = mustFail(DB, compatSql);
  assert.match(refusedCompat, /refusing pointer identity compat without the staging project latch/);
  must(DB, compatSql, [LATCH]);
  must(DB, compatSql, [LATCH]);
  assert.match(must(DB, `
SELECT pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conrelid = 'email_automation.intake_queue'::regclass
   AND conname = 'intake_queue_pointer_or_webhook_identity';
`), /webhook_event_id IS NOT NULL/);

  const ordinary = must(DB, planFastAck(received({
    eventId: 'evt-ordinary',
    messageId: '<ordinary@example.com>',
  })).sql);
  assert.equal(ordinary.split('|')[0], '1');
  assert.equal(must(DB, `
SELECT folder || '|' || COALESCE(uid::text, '') || '|' || resolution_status
     || '|' || webhook_event_id || '|' || webhook_message_id || '|' || status
  FROM email_automation.intake_queue
 WHERE webhook_event_id = 'evt-ordinary';
`), 'INBOX||unresolved|evt-ordinary|<ordinary@example.com>|pending');

  const missing = must(DB, planFastAck(received({ eventId: 'evt-missing' })).sql);
  assert.equal(missing.split('|')[0], '1');
  assert.equal(must(DB, `
SELECT folder || '|' || COALESCE(uid::text, '') || '|' || resolution_status
     || '|' || webhook_event_id || '|' || COALESCE(webhook_message_id, '') || '|' || status
  FROM email_automation.intake_queue
 WHERE webhook_event_id = 'evt-missing';
`), 'INBOX||unresolved|evt-missing||pending');
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue WHERE uid IN (1001, 1002);
`), '2');

  const folderMissing = mustFail(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, resolution_status, status)
VALUES ('info@vent-guys.com', 'mbx_fast', NULL, 4242, 'legacy_pointer', 'pending');
`);
  assert.match(folderMissing, /intake_queue_pointer_or_webhook_identity/);
  const noEvent = mustFail(DB, `
INSERT INTO email_automation.intake_queue
  (mailbox, mailbox_resource_id, folder, uid, webhook_event_id, resolution_status, status)
VALUES ('info@vent-guys.com', 'mbx_fast', 'INBOX', NULL, NULL, 'unresolved', 'pending');
`);
  assert.match(noEvent, /check constraint/i);

  const blockedRollback = mustFail(DB, rollbackSql, [LATCH]);
  assert.match(blockedRollback, /rollback refused: rows with NULL uid exist/);
  assert.equal(must(DB, `
SELECT count(*) FROM information_schema.columns
 WHERE table_schema = 'email_automation' AND table_name = 'intake_queue'
   AND column_name = 'webhook_event_id';
`), '1');
  assert.match(must(DB, `
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'email_automation.intake_queue'::regclass
   AND conname = 'intake_queue_pointer_or_webhook_identity';
`), /webhook_event_id IS NOT NULL/);

  must(DB, 'DELETE FROM email_automation.intake_queue WHERE uid IS NULL;');
  must(DB, rollbackSql, [LATCH]);
  assert.equal(must(DB, SNAPSHOT), before);
  must(DB, rollbackSql, [LATCH]);
  assert.equal(must(DB, SNAPSHOT), before);
  assert.equal(must(DB, `
SELECT count(*) FROM email_automation.intake_queue WHERE uid IN (1001, 1002);
`), '2');
});

test('pointer identity compat and rollback fail closed without the staging latch', () => {
  recreate(DB_REFUSE);
  must(DB_REFUSE, STUB);
  must(DB_REFUSE, identitySql);
  const compatRefused = mustFail(DB_REFUSE, compatSql);
  assert.match(compatRefused, /staging project latch/);
  const compatNoColumn = mustFail(DB_REFUSE, compatSql, [LATCH]);
  assert.match(compatNoColumn, /webhook_event_id is absent/);
  assert.match(must(DB_REFUSE, `
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'email_automation.intake_queue'::regclass
   AND conname = 'intake_queue_pointer_or_webhook_identity';
`), /\(folder IS NULL\) = \(uid IS NULL\)/);
  must(DB_REFUSE, migrationSql, [LATCH]);
  assert.match(mustFail(DB_REFUSE, compatSql), /staging project latch/);
  assert.match(mustFail(DB_REFUSE, rollbackSql), /staging project latch/);
  assert.match(must(DB_REFUSE, `
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'email_automation.intake_queue'::regclass
   AND conname = 'intake_queue_pointer_or_webhook_identity';
`), /\(folder IS NULL\) = \(uid IS NULL\)/);
});
